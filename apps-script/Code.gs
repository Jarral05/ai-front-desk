/**
 * AI Front Desk: lead email and Google Sheet (Part 6).
 *
 * Paste this into Extensions → Apps Script of your own Google Sheet, then add three Script
 * Properties (Project Settings → Script Properties): NOTIFY_SECRET, NOTIFY_TO and SHEET_ID.
 * Setup steps: docs/apps-script-setup.md.
 *
 * The server writes the email and the row; this script only checks the secret and delivers them.
 * It emails only the NOTIFY_TO address saved here, never an address it is sent, so a leaked secret
 * can't be used to email anyone else.
 */

var HEADERS = ['Lead ID', 'Received (UTC)', 'Name', 'Phone', 'Email', 'Service', 'When', 'Score',
  'Why this score', 'AI summary', 'Message', 'Business'];

function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('NOTIFY_SECRET');
  if (!secret || secret.length < 32) return reply_(false, 'not set up');

  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply_(false, 'bad request');
  }
  if (!body || !sameText_(body.secret, secret)) return reply_(false, 'not allowed');
  if (typeof body.id !== 'string' || !/^[a-f0-9]{24}$/.test(body.id)) return reply_(false, 'bad request');

  // One at a time, so two leads arriving together can't land on the same row.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return reply_(false, 'busy');
  try {
    if (body.channel === 'sheet') return addRow_(props, body);
    if (body.channel === 'email') return sendEmail_(props, body);
    return reply_(false, 'bad request');
  } finally {
    lock.releaseLock();
  }
}

// A retry after a slow answer must not add the same lead twice: the lead's ID is in column A.
function addRow_(props, body) {
  var id = props.getProperty('SHEET_ID');
  if (!id) return reply_(false, 'not set up');
  if (!(body.row instanceof Array) || body.row.length !== HEADERS.length) return reply_(false, 'bad request');
  var sheet = SpreadsheetApp.openById(id).getSheets()[0];
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  var already = sheet.getRange('A:A').createTextFinder(body.id).matchEntireCell(true).findNext();
  if (!already) sheet.appendRow(body.row.map(function (cell) { return String(cell).slice(0, 2000); }));
  return reply_(true);
}

// The same for email, remembered for 6 hours (the longest Apps Script's cache keeps anything).
function sendEmail_(props, body) {
  var to = props.getProperty('NOTIFY_TO');
  if (!to) return reply_(false, 'not set up');
  if (!body.email || typeof body.email.subject !== 'string' || typeof body.email.body !== 'string') {
    return reply_(false, 'bad request');
  }
  var cache = CacheService.getScriptCache();
  if (cache.get('email:' + body.id)) return reply_(true);
  MailApp.sendEmail(to, body.email.subject.slice(0, 120), body.email.body.slice(0, 5000));
  cache.put('email:' + body.id, '1', 21600);
  return reply_(true);
}

// Compares fingerprints, so the check doesn't stop early at the first different character.
function sameText_(a, b) {
  var hash = function (text) {
    return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text)));
  };
  return hash(a) === hash(b);
}

function reply_(ok, error) {
  return ContentService
    .createTextOutput(JSON.stringify(ok ? { ok: true } : { ok: false, error: error }))
    .setMimeType(ContentService.MimeType.JSON);
}
