// The settings for lead emails and the Google Sheet (lib/notify.js), checked at startup.
// Kept apart from notify.js so config.js can use it without the two files loading each other.

export const CHANNELS = Object.freeze(['email', 'sheet']);
export const WEBHOOK_URL = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{10,200}\/exec$/;
export const MIN_SECRET = 32;

// Checks the settings at startup. Returns { url, secret, channels } or null when switched off.
export function notifySettings(env = process.env) {
  const url = (env.NOTIFY_WEBHOOK_URL || '').trim();
  const secret = (env.NOTIFY_SECRET || '').trim();
  if (!url && !secret) return null;
  if (!WEBHOOK_URL.test(url)) {
    throw new Error('NOTIFY_WEBHOOK_URL must be the web app address from Apps Script: '
      + 'https://script.google.com/macros/s/.../exec');
  }
  if (secret.length < MIN_SECRET) {
    throw new Error(`NOTIFY_SECRET must be at least ${MIN_SECRET} characters. Make one with: npm run make-secret`);
  }
  const channels = (env.NOTIFY_CHANNELS || CHANNELS.join(','))
    .split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);
  const unknown = channels.filter((c) => !CHANNELS.includes(c));
  if (unknown.length > 0 || channels.length === 0) {
    throw new Error(`NOTIFY_CHANNELS can be "email", "sheet" or "email,sheet", not "${env.NOTIFY_CHANNELS}".`);
  }
  return { url, secret, channels: [...new Set(channels)] };
}
