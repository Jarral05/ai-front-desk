// `npm run make-secret`: prints a new random secret for NOTIFY_SECRET (256 random bits).
// Paste the same text into .env and into the Apps Script's Script Properties, then close the window.
import { randomBytes } from 'node:crypto';

console.log(randomBytes(32).toString('base64url'));
