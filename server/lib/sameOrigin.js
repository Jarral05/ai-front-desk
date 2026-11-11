// Stops other websites sending requests with the owner's cookie (cross-site request forgery).
// The cookie is already SameSite=Strict; this is the second lock. Browsers always send an Origin
// header with a POST, PUT, PATCH or DELETE, and a page can't fake it. Same check as the portal.
import { config } from '../config.js';
import { HttpError } from '../errors.js';

export function sameOriginOnly(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const origin = req.get('origin');
  // No Origin: not a browser (for example the tests or curl), so no visitor's cookie to misuse.
  if (!origin) return next();

  const allowed = config.publicUrl ? new URL(config.publicUrl).host : req.get('host');
  let host = '';
  try {
    host = new URL(origin).host;
  } catch {
    host = '';
  }
  if (host !== allowed) throw new HttpError(403, 'Request refused');
  next();
}
