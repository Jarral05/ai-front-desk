// /api/owner: the clinic owner's sign-in and dashboard (Part 4).
// Everything after the sign-in check refuses anyone who isn't signed in.
import express from 'express';
import { z } from 'zod';
import { LIMITS } from '../config.js';
import { HttpError } from '../errors.js';
import { Counter, Lead, SCORES } from '../models.js';
import { bump, statLastDays, visitorId, windows } from '../lib/counters.js';
import { toCsv } from '../lib/csv.js';
import { isPasswordHash, verifyPassword } from '../lib/passwords.js';
import {
  endOwnerSession, findOwnerSession, ownerCookie, readCookie, sameText, startOwnerSession,
} from '../lib/ownerSession.js';
import { sameOriginOnly } from '../lib/sameOrigin.js';
import { getClinic } from '../lib/knowledge.js';
import { activeProfile } from '../lib/profiles.js';
import { sampleLeadDocs } from '../lib/samples.js';
import { knowledgeRoutes } from './knowledge.js';

const LoginInput = z.object({
  email: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(200),
});

// The same words for a wrong email and a wrong password, so this form can't be used to find out
// the owner's email address.
const BAD_LOGIN = "That email and password don't match.";

const LeadFilter = z.object({ score: z.enum(SCORES).optional() });
const StatusInput = z.object({ status: z.enum(['New', 'Contacted']) });
const LEAD_ID = /^[a-f0-9]{24}$/i;

// What the owner sees of a lead. The visitor's fingerprint and chat ID stay on the server.
function ownerLead(lead) {
  return {
    id: String(lead._id),
    receivedAt: lead.createdAt,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    service: lead.service,
    timing: lead.timing,
    message: lead.message,
    summary: lead.summary,
    score: lead.score,
    scoreReasons: lead.scoreReasons,
    status: lead.status,
    sample: Boolean(lead.sample),
  };
}

function findLeads(query) {
  const parsed = LeadFilter.safeParse(query);
  if (!parsed.success) throw new HttpError(400, 'Unknown score filter.');
  const filter = parsed.data.score ? { score: parsed.data.score } : {};
  return Lead.find(filter).sort({ createdAt: -1 }).limit(LIMITS.dashboardLeads).lean();
}

export function ownerRoutes({ owner, secure }) {
  const router = express.Router();
  const cookie = ownerCookie(secure);
  const { maxAge: _lifetime, ...clearOptions } = cookie.options; // clearing a cookie takes no lifetime
  const configured = Boolean(owner.email) && isPasswordHash(owner.passwordHash);
  const currentSession = (req) => (configured ? findOwnerSession(readCookie(req, cookie.name), owner) : null);

  router.use(sameOriginOnly);

  router.post('/login', async (req, res) => {
    if (!configured) {
      throw new HttpError(503, "Owner sign-in isn't set up yet. Add OWNER_EMAIL and OWNER_PASSWORD_HASH to the settings.");
    }
    const parsed = LoginInput.safeParse(req.body ?? {});
    if (!parsed.success) throw new HttpError(400, 'Please enter your email and password.');

    // Counted before the password is checked, so every guess costs a try. The count deletes
    // itself an hour after the first try; a successful sign-in clears it.
    const triesKey = `owner-login:${visitorId(req.ip)}`;
    if ((await bump(triesKey, 60 * 60)) > LIMITS.ownerLoginTriesPerHour) {
      throw new HttpError(429, 'Too many tries. Please wait an hour and try again.');
    }

    // Both checks always run, so a wrong email takes as long as a wrong password.
    const emailOk = sameText(parsed.data.email.toLowerCase(), owner.email);
    const passwordOk = await verifyPassword(parsed.data.password, owner.passwordHash);
    if (!emailOk || !passwordOk) throw new HttpError(401, BAD_LOGIN);

    await Counter.deleteOne({ _id: triesKey });
    // A brand-new token at every sign-in (OWASP: renew the session ID when privilege changes),
    // so a token someone planted beforehand is worth nothing.
    await endOwnerSession(readCookie(req, cookie.name));
    res.cookie(cookie.name, await startOwnerSession(owner), cookie.options);
    res.json({ ok: true, email: owner.email });
  });

  router.post('/logout', async (req, res) => {
    await endOwnerSession(readCookie(req, cookie.name));
    res.clearCookie(cookie.name, clearOptions);
    res.json({ ok: true });
  });

  // Tells the page whether to show the dashboard or the sign-in form.
  router.get('/session', async (req, res) => {
    const session = await currentSession(req);
    res.json(session ? { signedIn: true, email: session.email } : { signedIn: false });
  });

  // ---- Everything below needs a signed-in owner ----
  router.use(async (req, _res, next) => {
    if (!(await currentSession(req))) throw new HttpError(401, 'Please sign in.');
    next();
  });

  // Newest first, at most 200, optionally one score only.
  router.get('/leads', async (req, res) => {
    res.json({
      leads: (await findLeads(req.query)).map(ownerLead),
      samplesAvailable: activeProfile().sampleLeads.length > 0,
    });
  });

  router.get('/leads.csv', async (req, res) => {
    const leads = await findLeads(req.query);
    const rows = [
      ['Received (UTC)', 'Name', 'Email', 'Phone', 'Service', 'When', 'Message', 'Score', 'Why this score', 'AI summary', 'Status'],
      ...leads.map((lead) => [
        lead.createdAt.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        lead.name, lead.email, lead.phone, lead.service, lead.timing, lead.message,
        lead.score, lead.scoreReasons.join('; '), lead.summary ?? '', lead.status,
      ]),
    ];
    res.attachment(`${activeProfile().id}-leads-${new Date().toISOString().slice(0, 10)}.csv`);
    res.type('text/csv; charset=utf-8');
    res.send(toCsv(rows));
  });

  router.patch('/leads/:id', async (req, res) => {
    const parsed = StatusInput.safeParse(req.body ?? {});
    if (!parsed.success) throw new HttpError(400, 'The status can be New or Contacted.');
    const lead = LEAD_ID.test(req.params.id)
      ? await Lead.findByIdAndUpdate(req.params.id, { $set: { status: parsed.data.status } }, { returnDocument: 'after' }).lean()
      : null;
    if (!lead) throw new HttpError(404, 'That lead no longer exists. Leads delete themselves after 24 hours.');
    res.json({ lead: ownerLead(lead) });
  });

  // The last 7 days, from the daily counters (lib/counters.js).
  router.get('/stats', async (_req, res) => {
    const days = LIMITS.statsDays;
    const [chats, leads, hot] = await Promise.all(['chats', 'leads', 'hot'].map((kind) => statLastDays(kind, days)));
    // Sample leads aren't in the daily counters; the page adds them and says so.
    const [sampleLeads, sampleHot] = await Promise.all([
      Lead.countDocuments({ sample: true }),
      Lead.countDocuments({ sample: true, score: 'Hot' }),
    ]);
    res.json({ days, chats, leads, hot, samples: { leads: sampleLeads, hot: sampleHot } });
  });

  // Sample leads for showing the dashboard. Filling again replaces the earlier samples, and
  // removing them never touches a real lead.
  router.post('/sample-leads', async (_req, res) => {
    const { sampleLeads } = activeProfile();
    if (sampleLeads.length === 0) throw new HttpError(404, 'This page has no sample leads.');
    if ((await bump(`owner-samples:${windows.hour()}`, 2 * 60 * 60)) > LIMITS.sampleFillsPerHour) {
      throw new HttpError(429, 'That is a lot of sample fills this hour. Please try again later.');
    }
    const services = (await getClinic()).services.map((service) => service.name);
    await Lead.deleteMany({ sample: true });
    // The times are the samples' own ("40 minutes ago"), so Mongoose mustn't set them.
    await Lead.insertMany(sampleLeadDocs(sampleLeads, services), { timestamps: false });
    res.status(201).json({ count: sampleLeads.length });
  });

  router.delete('/sample-leads', async (_req, res) => {
    const { deletedCount } = await Lead.deleteMany({ sample: true });
    res.json({ count: deletedCount });
  });

  router.use('/knowledge', knowledgeRoutes());

  return router;
}
