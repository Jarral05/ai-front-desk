// Part 6: every new lead is emailed to the owner and added to their Google Sheet, through one
// Google Apps Script web app the owner deploys from their own Google account (apps-script/Code.gs).
//
// Why one script for both (decision 0007): no email package, no mailbox password on the server, and
// the script only ever emails the one address saved in its own settings, so even a leaked secret
// can't be used to email anyone else.
//
// Google's docs (read 12 Nov 2026): a web app can't read request headers, so the shared secret goes
// in the body; and its answer is "redirected to a one-time URL", so the request must follow redirects.
import { LIMITS } from '../config.js';
import { Lead } from '../models.js';

export { CHANNELS } from './notifySettings.js';

// Every cell goes in as text, exactly as typed. A leading ' tells Google Sheets "this is text" and
// isn't shown (proved in the owner's real run, 12 Nov: a lead named =1+1 showed as =1+1, not 2).
// So a formula can't run, and a phone number like 03001234567 keeps its first 0 instead of
// becoming the number 3001234567 (the owner's run showed phone numbers turned into numbers).
export function sheetCell(value) {
  const text = value == null ? '' : String(value);
  return text === '' ? '' : `'${text}`;
}

// One line for an email subject: no line breaks (they could start new headers), at most 120 characters.
const oneLine = (text, max) => String(text ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);

// What the script receives. The server writes the email and the row; the script only delivers
// them, so the logic stays here, where it's tested.
export function leadMessage(lead, clinic, { dashboardUrl = '' } = {}) {
  const received = new Date(lead.createdAt ?? Date.now());
  const reasons = (lead.scoreReasons ?? []).join('; ');
  const lines = [
    `New ${lead.score} lead for ${clinic.name}`,
    '',
    `Name: ${lead.name}`,
    `Phone: ${lead.phone || '(not given)'}`,
    `Email: ${lead.email || '(not given)'}`,
    `Service: ${lead.service}`,
    `When: ${lead.timing}`,
    `Score: ${lead.score}${reasons ? ` (${reasons})` : ''}`,
    '',
    `AI summary: ${lead.summary ?? '(none: the AI was not available)'}`,
    `Their message: ${lead.message || '(none)'}`,
    '',
    `Received: ${received.toISOString().replace('T', ' ').slice(0, 16)} UTC`,
    ...(dashboardUrl ? [`Open the dashboard: ${dashboardUrl}`] : []),
    '',
    'This is a demo. Details sent through the demo are made up and delete themselves after 24 hours.',
  ];
  return {
    id: String(lead._id),
    email: {
      subject: oneLine(`New ${lead.score} lead: ${lead.service}`, 120),
      body: lines.join('\n'),
    },
    row: [
      String(lead._id), received.toISOString(), lead.name, lead.phone, lead.email, lead.service,
      lead.timing, lead.score, reasons, lead.summary ?? '', lead.message, clinic.name,
    ].map(sheetCell),
  };
}

// Talks to the owner's script. `fetchImpl` is only passed by the tests.
export function createNotifier(settings, { fetchImpl = fetch } = {}) {
  if (!settings) return null;
  return {
    channels: settings.channels,
    // Resolves to { ok: true } or { ok: false, error: 'a short reason' }. Never throws, never
    // includes the secret or the visitor's details in the reason.
    async send(channel, message) {
      let res;
      try {
        res = await fetchImpl(settings.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: settings.secret, channel, ...message }),
          redirect: 'follow',
          signal: AbortSignal.timeout(LIMITS.notifyTimeoutMs),
        });
      } catch (error) {
        return { ok: false, error: error?.name === 'TimeoutError' ? 'timed out' : 'no connection' };
      }
      if (!res.ok) return { ok: false, error: `answered ${res.status}` };
      let data;
      try {
        data = JSON.parse(await res.text());
      } catch {
        return { ok: false, error: 'not a script answer' };
      }
      if (data?.ok === true) return { ok: true };
      return { ok: false, error: oneLine(data?.error || 'refused', 60) };
    },
  };
}

// Sends one lead to each channel and records the result on the lead. Never throws: a failure only
// ever marks the lead "Not sent", which the owner can retry.
export async function deliverLead(notifier, leadId, clinic, channels = notifier?.channels ?? [], options = {}) {
  if (!notifier || channels.length === 0) return;
  try {
    const lead = await Lead.findById(leadId).lean();
    if (!lead) return;
    const message = leadMessage(lead, clinic, options);
    await Promise.all(channels.map(async (channel) => {
      // send() isn't meant to throw, but if it ever did, the lead must still end as "Not sent",
      // never stay "Sending" for ever.
      const result = await notifier.send(channel, message).catch(() => ({ ok: false, error: 'failed' }));
      await Lead.updateOne({ _id: leadId }, {
        $set: {
          [`notify.${channel}.status`]: result.ok ? 'sent' : 'failed',
          [`notify.${channel}.at`]: new Date(),
          [`notify.${channel}.error`]: result.ok ? '' : result.error,
        },
        $inc: { [`notify.${channel}.tries`]: 1 },
      });
      if (!result.ok) console.error(`Lead ${channel} not sent:`, result.error);
    }));
  } catch (error) {
    console.error('Lead notification failed:', error?.message ?? 'unknown error');
  }
}
