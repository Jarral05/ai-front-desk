// All settings in one place. Secrets come from environment variables, never from code.
const isProd = process.env.NODE_ENV === 'production';

// Stop at startup, with a clear message, rather than fail later on a visitor's request.
export function checkProductionSettings(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  for (const name of ['MONGODB_URI', 'PUBLIC_URL', 'GEMINI_API_KEY']) {
    if (!env[name]) throw new Error(`${name} must be set in production.`);
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
});
