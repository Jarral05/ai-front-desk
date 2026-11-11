// All settings in one place. Secrets come from environment variables, never from code.
import { isPasswordHash } from './lib/passwords.js';

const isProd = process.env.NODE_ENV === 'production';

// Stop at startup, with a clear message, rather than fail later on a visitor's request.
export function checkProductionSettings(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  for (const name of ['MONGODB_URI', 'PUBLIC_URL', 'GEMINI_API_KEY', 'OWNER_EMAIL', 'OWNER_PASSWORD_HASH']) {
    if (!env[name]) throw new Error(`${name} must be set in production.`);
  }
  if (!isPasswordHash(env.OWNER_PASSWORD_HASH)) {
    throw new Error('OWNER_PASSWORD_HASH must be a hash made with "npm run hash-password".');
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
  aiCallsPerDay: 300,
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
});
