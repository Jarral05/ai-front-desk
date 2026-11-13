// All settings in one place. Secrets come from environment variables, never from code.
import { isPasswordHash } from './lib/passwords.js';
import { notifySettings } from './lib/notifySettings.js';
import { loadProfile } from './lib/profiles.js';

const isProd = process.env.NODE_ENV === 'production';

// Which Gemini tier the key's project is on. Google's terms (13 Nov 2026): an app open to users in
// the EEA, Switzerland or the UK may use only the paid tier, so the live site must say "paid".
export function geminiTier(env = process.env) {
  const tier = (env.GEMINI_TIER || 'free').trim().toLowerCase();
  if (!['free', 'paid'].includes(tier)) throw new Error(`GEMINI_TIER can be "free" or "paid", not "${env.GEMINI_TIER}".`);
  return tier;
}

// The whole app's AI calls a day: the hard stop that caps the Gemini bill. 300 unless set lower;
// the live demo uses 100 (owner's decision, 13 Nov 2026).
export const MAX_AI_CALLS_PER_DAY = 300;
export function dailyAiLimit(env = process.env) {
  const raw = (env.AI_CALLS_PER_DAY ?? '').trim();
  if (raw === '') return MAX_AI_CALLS_PER_DAY;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_AI_CALLS_PER_DAY) {
    throw new Error(`AI_CALLS_PER_DAY must be a whole number from 1 to ${MAX_AI_CALLS_PER_DAY}, not "${raw}".`);
  }
  return value;
}

// Stop at startup, with a clear message, rather than fail later on a visitor's request.
export function checkProductionSettings(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  for (const name of ['MONGODB_URI', 'PUBLIC_URL', 'GEMINI_API_KEY', 'OWNER_EMAIL', 'OWNER_PASSWORD_HASH']) {
    if (!env[name]) throw new Error(`${name} must be set in production.`);
  }
  if (!isPasswordHash(env.OWNER_PASSWORD_HASH)) {
    throw new Error('OWNER_PASSWORD_HASH must be a hash made with "npm run hash-password".');
  }
  if (geminiTier(env) !== 'paid') {
    throw new Error('GEMINI_TIER must be "paid" in production: Google\'s terms allow only the paid tier '
      + 'for an app open to users in the EEA, Switzerland or the UK.');
  }
}

checkProductionSettings();

export const config = {
  isProd,
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGODB_URI || '',
  publicUrl: process.env.PUBLIC_URL || '',
  // How many proxies sit in front of the app. Rate limits need the real visitor IP.
  trustProxy: Number(process.env.TRUST_PROXY ?? 1),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  // gemini-3.5-flash-lite has the highest free per-minute limit (decision 0002).
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  geminiTier: geminiTier(),
  // Which business this copy shows (lib/profiles.js). A wrong name or a broken profile file
  // stops the app here, at startup, with a clear message.
  profile: loadProfile(),
  // Lead email and Google Sheet (lib/notify.js). Null when not set up; a broken setting stops
  // the app at startup.
  notify: notifySettings(),
  // The one owner account. The password itself is never stored: only its hash.
  owner: {
    email: (process.env.OWNER_EMAIL || '').trim().toLowerCase(),
    passwordHash: (process.env.OWNER_PASSWORD_HASH || '').trim(),
  },
};

// The limits from docs/SPEC.md. Google's free tier allows 15 calls a minute and 500 a day for
// this model, so the whole app stays below both and leaves room for the owner's own testing.
export const LIMITS = Object.freeze({
  messageChars: 500,
  messagesPerConversation: 20,
  messagesPerVisitorHour: 30,
  leadsPerVisitorHour: 5,
  aiCallsPerMinute: 12,
  aiCallsPerDay: dailyAiLimit(),
  aiTimeoutMs: 15000,
  // Conversations and leads delete themselves after this long (a MongoDB TTL index).
  keepHours: 24,

  // Owner sign-in (Part 4). OWASP's session advice: 15 to 30 minutes idle for a low-risk app,
  // and an absolute end of 4 to 8 hours for a working day.
  ownerLoginTriesPerHour: 10,
  ownerIdleMinutes: 30,
  ownerSessionHours: 8,
  dashboardLeads: 200,
  statsDays: 7,

  // What the bot knows (Part 5).
  knowledgeChars: 20000,
  pdfBytes: 2 * 1024 * 1024,
  pdfPages: 20,
  pdfTimeoutMs: 10000,
  pdfUploadsPerHour: 20,

  // Sample leads for showing the dashboard (lib/samples.js).
  sampleFillsPerHour: 20,

  // Lead email and Google Sheet (Part 6). Apps Script can take a few seconds to wake up.
  notifyTimeoutMs: 10000,
  notifyRetriesPerHour: 30,
});
