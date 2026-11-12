// The owner's Apps Script (apps-script/Code.gs), run here with stand-ins for Google's services.
// It proves the script's own rules; the real Google run is the owner's check (docs/apps-script-setup.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const CODE = fs.readFileSync(path.join(import.meta.dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
const SECRET = 's'.repeat(43);
const ID = '0123456789abcdef01234567';
const ROW = Array.from({ length: 12 }, (_, i) => (i === 0 ? ID : `cell ${i}`));

function world({ props = { NOTIFY_SECRET: SECRET, NOTIFY_TO: 'owner@example.com', SHEET_ID: 'sheet-123' }, lockFree = true } = {}) {
  const rows = [];
  const mails = [];
  const opened = [];
  const cache = new Map();
  const lock = { held: false };
  const sheet = {
    getLastRow: () => rows.length,
    appendRow: (row) => rows.push(row),
    getRange: () => ({
      createTextFinder: (text) => ({
        matchEntireCell() { return this; },
        findNext: () => (rows.some((row) => row[0] === text) ? {} : null),
      }),
    }),
  };
  const context = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => props[key] ?? null }) },
    SpreadsheetApp: { openById: (id) => { opened.push(id); return { getSheets: () => [sheet] }; } },
    MailApp: { sendEmail: (to, subject, body) => mails.push({ to, subject, body }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v) }) },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => { lock.held = lockFree; return lockFree; },
        releaseLock: () => { lock.held = false; },
      }),
    },
    ContentService: {
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
      MimeType: { JSON: 'application/json' },
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (_alg, text) => [...createHash('sha256').update(text).digest()],
      base64Encode: (bytes) => Buffer.from(bytes).toString('base64'),
    },
  };
  vm.createContext(context);
  vm.runInContext(CODE, context);
  const post = (body) => JSON.parse(context.doPost({
    postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) },
  }).text);
  return { post, rows, mails, opened, lock };
}

const sheetBody = (extra = {}) => ({ secret: SECRET, channel: 'sheet', id: ID, row: ROW, ...extra });
const emailBody = (extra = {}) => ({ secret: SECRET, channel: 'email', id: ID, email: { subject: 'New Hot lead: Massage', body: 'Hello' }, ...extra });

test('the script refuses anything without the right secret, and says when it is not set up', () => {
  const w = world();
  assert.deepEqual(w.post(sheetBody({ secret: 'wrong' })), { ok: false, error: 'not allowed' });
  assert.deepEqual(w.post(sheetBody({ secret: undefined })), { ok: false, error: 'not allowed' });
  assert.deepEqual(w.post('not json'), { ok: false, error: 'bad request' });
  assert.deepEqual(w.post(sheetBody({ id: '../../x' })), { ok: false, error: 'bad request' });
  assert.deepEqual(w.post(sheetBody({ channel: 'sms' })), { ok: false, error: 'bad request' });
  assert.equal(w.rows.length + w.mails.length, 0);

  assert.deepEqual(world({ props: {} }).post(sheetBody()), { ok: false, error: 'not set up' });
  assert.deepEqual(world({ props: { NOTIFY_SECRET: 'short' } }).post(sheetBody({ secret: 'short' })), { ok: false, error: 'not set up' });
  assert.deepEqual(world({ props: { NOTIFY_SECRET: SECRET } }).post(sheetBody()), { ok: false, error: 'not set up' });
  assert.deepEqual(world({ props: { NOTIFY_SECRET: SECRET } }).post(emailBody()), { ok: false, error: 'not set up' });
});

test('the sheet gets a header row once, then each lead once, even when Retry repeats it', () => {
  const w = world();
  assert.deepEqual(w.post(sheetBody()), { ok: true });
  assert.equal(w.opened[0], 'sheet-123'); // opened by its ID: a web app can't use "the active sheet"
  assert.equal(w.rows.length, 2);
  assert.equal(w.rows[0][0], 'Lead ID');
  // Rows made inside the sandbox are its own kind of array; compare the values.
  assert.deepEqual([...w.rows[1]], ROW);
  assert.deepEqual(w.post(sheetBody()), { ok: true });
  assert.equal(w.rows.length, 2);
  assert.deepEqual(w.post(sheetBody({ row: ['too short'] })), { ok: false, error: 'bad request' });
  assert.equal(w.lock.held, false);
});

test('the email goes only to the address saved in the script, once per lead', () => {
  const w = world();
  // An address in the message is ignored: the script has no way to email anyone else.
  assert.deepEqual(w.post(emailBody({ to: 'victim@example.com' })), { ok: true });
  assert.deepEqual(w.mails, [{ to: 'owner@example.com', subject: 'New Hot lead: Massage', body: 'Hello' }]);
  assert.deepEqual(w.post(emailBody()), { ok: true });
  assert.equal(w.mails.length, 1);
  assert.deepEqual(w.post(emailBody({ id: 'abcdefabcdefabcdefabcdef', email: { subject: 'x'.repeat(500), body: 'y' } })), { ok: true });
  assert.equal(w.mails[1].subject.length, 120);
  assert.deepEqual(w.post(emailBody({ id: 'bbbbbbbbbbbbbbbbbbbbbbbb', email: { subject: 1 } })), { ok: false, error: 'bad request' });
  assert.equal(w.lock.held, false);
});

test('when another lead holds the lock for too long, the script says "busy" and the lead can be retried', () => {
  const w = world({ lockFree: false });
  assert.deepEqual(w.post(sheetBody()), { ok: false, error: 'busy' });
  assert.equal(w.rows.length, 0);
});
