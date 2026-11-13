// Builds the Express app. Kept apart from server.js so the tests can use it directly.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { HttpError } from './errors.js';
import { createGeminiAi } from './lib/ai.js';
import { publicClinic } from './lib/clinic.js';
import { getClinic } from './lib/knowledge.js';
import { activeProfile, useProfile } from './lib/profiles.js';
import { chatRoutes } from './routes/chat.js';
import { leadRoutes } from './routes/leads.js';
import { myLeadRoutes } from './routes/myLead.js';
import { createNotifier } from './lib/notify.js';
import { ownerRoutes } from './routes/owner.js';

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

export { HttpError };

// `ai`, `owner`, `profile` and `notifier` can be passed in: the tests use a fake AI, a test owner,
// each profile in turn and a fake script. Otherwise Gemini is used when a key is set, and the
// owner account, the profile and the lead email and sheet come from the settings.
export function createApp({
  ai = createGeminiAi({ apiKey: config.geminiApiKey, model: config.geminiModel }),
  owner = config.owner,
  profile = config.profile,
  notifier = createNotifier(config.notify),
  tier = config.geminiTier,
} = {}) {
  useProfile(profile);
  const app = express();
  // Lead emails and sheet rows still on their way (routes/leads.js). The tests wait for these.
  app.locals.pending = new Set();
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(config.isProd ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    strictTransportSecurity: config.isProd,
  }));
  // A demo with made-up data has no reason to be in search results.
  app.use((_req, res, next) => {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    next();
  });

  const api = express.Router();
  api.use((_req, res, next) => {
    // API answers are never cached by a browser, CDN or proxy.
    res.set('Cache-Control', 'no-store, private');
    next();
  });
  api.use(express.json({ limit: '20kb' }));

  api.get('/health', (_req, res) => res.json({ ok: true }));
  // The owner's facts if they've edited them, else the demo facts. Never the PDF's text.
  api.get('/clinic', async (_req, res) => res.json(publicClinic(await getClinic(), tier)));
  // A private profile's logo, checked when the app started (lib/profiles.js).
  api.get('/logo', (_req, res) => {
    const { logo } = activeProfile();
    if (!logo) throw new HttpError(404, 'Not found');
    res.type(logo.type).send(logo.bytes);
  });
  api.use('/chat', chatRoutes({ ai }));
  api.use('/leads', leadRoutes({ ai, notifier, secure: config.isProd }));
  api.use('/my-lead', myLeadRoutes({ secure: config.isProd }));
  api.use('/owner', ownerRoutes({ owner, secure: config.isProd, notifier, tier }));

  api.use(() => {
    throw new HttpError(404, 'Not found');
  });
  app.use('/api', api);

  // The built React page. Hashed files never change, so they can be cached for a long time.
  app.use(express.static(DIST, {
    index: false,
    setHeaders(res, filePath) {
      const hashed = filePath.includes(`${path.sep}assets${path.sep}`);
      res.set('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache');
    },
  }));
  app.get('/{*page}', (_req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(DIST, 'index.html'));
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, ...(err.fields ? { fields: err.fields } : {}) });
    }
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That is too long.' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request' });
    console.error(err);
    // Never send stack traces or database errors to the browser.
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}
