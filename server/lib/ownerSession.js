// The owner's sign-in, without a session package (decision 0005).
//
// Signing in makes a random token. The browser keeps it in a cookie it can't read from JavaScript;
// the database keeps only its SHA-256 fingerprint. Each request turns the cookie back into the
// fingerprint and looks it up. OWASP's Session Management Cheat Sheet asks for at least 128 random
// bits; this uses 256.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { LIMITS } from '../config.js';
import { OwnerSession } from '../models.js';

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

export const sha256 = (text) => createHash('sha256').update(String(text)).digest('hex');

// True when two strings match, compared in a way that takes the same time either way.
export function sameText(a, b) {
  return timingSafeEqual(createHash('sha256').update(String(a)).digest(), createHash('sha256').update(String(b)).digest());
}

// The cookie's name and settings. Over HTTPS the name starts with __Host-, which browsers only
// accept from this exact host, over HTTPS, for the whole site: no other subdomain of the same
// website can set or replace it. Plain-HTTP local testing can't use the prefix.
export function ownerCookie(secure) {
  return {
    name: secure ? '__Host-fd_owner' : 'fd_owner',
    options: {
      httpOnly: true, // page scripts can't read it, so injected script can't steal it
      secure, // only sent over HTTPS
      sameSite: 'strict', // never sent with a request that another website starts
      path: '/',
      maxAge: LIMITS.ownerSessionHours * HOUR,
    },
  };
}

// Express 5 doesn't read cookies by itself, and one cookie doesn't need a package.
export function readCookie(req, name) {
  for (const part of String(req.get('cookie') ?? '').split(';')) {
    const at = part.indexOf('=');
    if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return '';
}

// A short fingerprint of the password hash. A new password gives a new fingerprint, and sessions
// that carry the old one stop working.
const passwordFingerprint = (passwordHash) => sha256(`owner-password:${passwordHash}`).slice(0, 16);

export async function startOwnerSession(owner) {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  await OwnerSession.create({
    _id: sha256(token),
    email: owner.email,
    passwordFingerprint: passwordFingerprint(owner.passwordHash),
    endsAt: new Date(now + LIMITS.ownerSessionHours * HOUR),
    expiresAt: new Date(now + LIMITS.ownerIdleMinutes * MINUTE),
  });
  return token;
}

// Returns the session if the token is current, else null. MongoDB deletes expired sessions about
// once a minute, so the times are checked here too.
export async function findOwnerSession(token, owner) {
  if (!token || token.length > 100) return null;
  const session = await OwnerSession.findById(sha256(token)).lean();
  if (!session) return null;

  const now = Date.now();
  const current = session.email === owner.email
    && session.passwordFingerprint === passwordFingerprint(owner.passwordHash)
    && session.expiresAt.getTime() > now
    && session.endsAt.getTime() > now;
  if (!current) {
    await OwnerSession.deleteOne({ _id: session._id });
    return null;
  }

  // Still in use: move the idle end on, never past the absolute end, writing at most once a minute.
  const next = Math.min(now + LIMITS.ownerIdleMinutes * MINUTE, session.endsAt.getTime());
  if (next - session.expiresAt.getTime() > MINUTE) {
    await OwnerSession.updateOne({ _id: session._id }, { $set: { expiresAt: new Date(next) } });
  }
  return session;
}

export function endOwnerSession(token) {
  return token ? OwnerSession.deleteOne({ _id: sha256(token) }) : null;
}
