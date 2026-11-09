// All settings in one place. Secrets come from environment variables, never from code.
const isProd = process.env.NODE_ENV === 'production';

// Stop at startup, with a clear message, rather than fail later on a visitor's request.
export function checkProductionSettings(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  for (const name of ['MONGODB_URI', 'PUBLIC_URL']) {
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
};
