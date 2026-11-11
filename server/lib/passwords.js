// The owner's password is stored as a scrypt hash, with Node's own crypto: no package (decision 0005).
//
// A hash is one-way: the app can check a typed password against it, but nobody can turn the hash
// back into the password. The salt (random bytes, different for every hash) means two people with
// the same password still get different hashes, so ready-made tables of hashes are useless.
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

// OWASP's Password Storage Cheat Sheet: N=2^17, r=8, p=1 (128 MiB of memory per check), or one of
// its listed equals. N=2^15, r=8, p=3 needs 32 MiB, which suits a small shared server.
export const SCRYPT = Object.freeze({ N: 2 ** 15, r: 8, p: 3, keyLength: 32, saltLength: 16 });

// scrypt needs about 128 × N × r bytes. Node refuses above its 32 MiB default, so allow double.
const memoryFor = (N, r) => 256 * N * r;

// The same password typed on a phone or a PC can arrive as different Unicode bytes ("é" as one
// character or as "e" plus an accent). NFKC turns both into one form before hashing.
const normalise = (password) => String(password).normalize('NFKC');

// "scrypt:32768:8:3:<salt>:<hash>". No $ signs, so it survives .env files and settings panels.
export async function hashPassword(password, { N, r, p, keyLength, saltLength } = SCRYPT) {
  const salt = randomBytes(saltLength);
  const key = await scrypt(normalise(password), salt, keyLength, { N, r, p, maxmem: memoryFor(N, r) });
  return ['scrypt', N, r, p, salt.toString('base64url'), key.toString('base64url')].join(':');
}

// Reads a stored hash. Anything that isn't exactly our format, or would need more than 128 MiB to
// check, is refused rather than guessed at.
export function parseHash(text) {
  const parts = String(text ?? '').trim().split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  const salt = Buffer.from(parts[4], 'base64url');
  const key = Buffer.from(parts[5], 'base64url');
  const sane = Number.isInteger(N) && Number.isInteger(r) && Number.isInteger(p)
    && N >= 2 ** 14 && (N & (N - 1)) === 0 && r >= 8 && p >= 1 && p <= 16
    && N * r <= 2 ** 20 && salt.length >= 16 && key.length >= 32;
  return sane ? { N, r, p, salt, key } : null;
}

export const isPasswordHash = (text) => parseHash(text) !== null;

export async function verifyPassword(password, stored) {
  const parsed = parseHash(stored);
  if (!parsed) return false;
  const { N, r, p, salt, key } = parsed;
  const attempt = await scrypt(normalise(password), salt, key.length, { N, r, p, maxmem: memoryFor(N, r) });
  // Compares every byte, however early a difference is, so timing gives nothing away.
  return timingSafeEqual(attempt, key);
}
