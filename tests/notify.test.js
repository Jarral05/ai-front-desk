// Part 6 checks: every lead is emailed and added to the sheet, a failure never loses a lead and shows
// "Not sent" with Retry, and a buyer sees only their own lead.
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { CHILDRENS_HOSPITAL } from '../server/lib/profiles.js';
import { createNotifier, leadMessage, sheetCell } from '../server/lib/notify.js';
import { notifySettings } from '../server/lib/notifySettings.js';
import { myLeadCookie } from '../server/routes/myLead.js';
import { Lead } from '../server/models.js';
import {
  fakeAi, fakeNotifier, newVisitor, nextMinute, settle, signIn, startDatabase, stopDatabase, testOwner,
} from './helpers.js';

before(startDatabase);
after(stopDatabase);
beforeEach(nextMinute);

const URL_OK = 'https://script.google.com/macros/s/AKfycbx_demo-Script_ID_1234567890/exec';
const SECRET = 'x'.repeat(43);
const SUMMARY = JSON.stringify({
  summary: 'Sam Sample wants a sports massage this week. They are ready to book.',
  intent: 'ready_to_book',
});
const booking = (overrides = {}) => ({
  name: 'Sam Sample', email: 'sam@example.com', service: 'Sports massage', timing: 'This week', ...overrides,
});
const cookieFrom = (res) => (res.headers['set-cookie'] ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith('fd_my_lead='));

// ---- Settings ----

test('lead email and the sheet are off with no settings, and wrong settings stop the app', () => {
  assert.equal(notifySettings({}), null);
  assert.deepEqual(notifySettings({ NOTIFY_WEBHOOK_URL: URL_OK, NOTIFY_SECRET: SECRET }),
    { url: URL_OK, secret: SECRET, channels: ['email', 'sheet'] });
  assert.deepEqual(notifySettings({ NOTIFY_WEBHOOK_URL: URL_OK, NOTIFY_SECRET: SECRET, NOTIFY_CHANNELS: ' Sheet ' }).channels, ['sheet']);

  // Only Google's Apps Script address: the setting can't send leads anywhere else.
  for (const url of ['http://script.google.com/macros/s/AKfycbx_demo1234/exec', 'https://evil.example/macros/s/AKfycbx_demo1234/exec',
    'https://script.google.com/macros/s/AKfycbx_demo1234/dev', 'https://script.google.com.evil.example/macros/s/AKfycbx_demo1234/exec']) {
    assert.throws(() => notifySettings({ NOTIFY_WEBHOOK_URL: url, NOTIFY_SECRET: SECRET }), /NOTIFY_WEBHOOK_URL must be/, url);
  }
  assert.throws(() => notifySettings({ NOTIFY_SECRET: SECRET }), /NOTIFY_WEBHOOK_URL must be/);
  assert.throws(() => notifySettings({ NOTIFY_WEBHOOK_URL: URL_OK, NOTIFY_SECRET: 'short' }), /at least 32 characters.*npm run make-secret/);
  assert.throws(() => notifySettings({ NOTIFY_WEBHOOK_URL: URL_OK, NOTIFY_SECRET: SECRET, NOTIFY_CHANNELS: 'email,sms' }), /NOTIFY_CHANNELS can be/);
});

// ---- What is sent ----

test('the email and the row are built here, safely: no formula can run in the sheet, no header in the subject', () => {
  const lead = {
    _id: '0123456789abcdef01234567', createdAt: new Date('2026-11-12T10:30:00Z'), name: '=HYPERLINK("http://evil.example","Click")',
    phone: '+1 555 0100', email: '', service: 'Sports massage\r\nBcc: someone@example.com', timing: 'This week', score: 'Hot',
    scoreReasons: ['Wants a time this week (+2)'], summary: 'Sam wants a massage.', message: '@SUM(A1:A9)',
  };
  const message = leadMessage(lead, { name: 'Maple Lane Physio (Demo)' }, { dashboardUrl: 'https://demo.example/owner' });
  assert.equal(message.id, '0123456789abcdef01234567');
  assert.doesNotMatch(message.email.subject, /[\r\n]/);
  assert.ok(message.email.subject.length <= 120);
  assert.match(message.email.body, /^New Hot lead for Maple Lane Physio \(Demo\)\n/);
  assert.match(message.email.body, /Email: \(not given\)/);
  assert.match(message.email.body, /AI summary: Sam wants a massage\./);
  assert.match(message.email.body, /Open the dashboard: https:\/\/demo\.example\/owner/);
  assert.match(message.email.body, /This is a demo\./);
  assert.equal(message.row.length, 12);
  assert.equal(message.row[2], `'=HYPERLINK("http://evil.example","Click")`);
  assert.equal(message.row[10], "'@SUM(A1:A9)");
  assert.equal(message.row[3], "'+1 555 0100"); // a + start is risky too; it still reads as the number
  assert.equal(sheetCell('Plain text, "quoted"'), 'Plain text, "quoted"');
  assert.equal(sheetCell(null), '');
});

test("the real notifier sends the secret in the body, follows Google's redirect, and turns every failure into a reason", async () => {
  const sent = [];
  const answer = { value: () => new Response('{"ok":true}', { status: 200 }) };
  const fetchImpl = async (url, options) => {
    sent.push({ url, options });
    return answer.value();
  };
  const notifier = createNotifier({ url: URL_OK, secret: SECRET, channels: ['email', 'sheet'] }, { fetchImpl });
  const message = { id: 'abc', email: { subject: 's', body: 'b' }, row: ['a'] };

  assert.deepEqual(await notifier.send('sheet', message), { ok: true });
  assert.equal(sent[0].url, URL_OK);
  assert.equal(sent[0].options.method, 'POST');
  assert.equal(sent[0].options.redirect, 'follow');
  assert.ok(sent[0].options.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(sent[0].options.body), { secret: SECRET, channel: 'sheet', ...message });

  answer.value = () => new Response('{"ok":false,"error":"not allowed"}', { status: 200 });
  assert.deepEqual(await notifier.send('email', message), { ok: false, error: 'not allowed' });
  answer.value = () => new Response('<!doctype html><title>Error</title>', { status: 200 });
  assert.deepEqual(await notifier.send('email', message), { ok: false, error: 'not a script answer' });
  answer.value = () => new Response('oops', { status: 500 });
  assert.deepEqual(await notifier.send('email', message), { ok: false, error: 'answered 500' });
  answer.value = () => { throw Object.assign(new Error('slow'), { name: 'TimeoutError' }); };
  assert.deepEqual(await notifier.send('email', message), { ok: false, error: 'timed out' });
  answer.value = () => { throw new TypeError('fetch failed'); };
  assert.deepEqual(await notifier.send('email', message), { ok: false, error: 'no connection' });
  // A reason never carries the secret.
  answer.value = () => new Response(JSON.stringify({ ok: false, error: `bad ${SECRET}`.repeat(3) }), { status: 200 });
  assert.ok((await notifier.send('email', message)).error.length <= 60);

  assert.equal(createNotifier(null), null);
});

// ---- A new lead ----

test('a new lead is emailed and added to the sheet after the visitor has their answer', async () => {
  const notifier = fakeNotifier();
  const app = createApp({ ai: fakeAi(SUMMARY), notifier });
  const res = await newVisitor(app).post('/api/leads').send(booking());
  assert.equal(res.status, 201);
  await settle(app);

  const lead = await Lead.findOne({ email: 'sam@example.com' }).sort({ createdAt: -1 }).lean();
  assert.equal(lead.notify.email.status, 'sent');
  assert.equal(lead.notify.sheet.status, 'sent');
  assert.equal(lead.notify.email.tries, 1);
  assert.deepEqual(notifier.calls.map((c) => c.channel).sort(), ['email', 'sheet']);
  const { message } = notifier.calls[0];
  assert.equal(message.id, String(lead._id));
  // The AI summary and score were saved before the email was written.
  assert.match(message.email.subject, /^New Hot lead: Sports massage$/);
  assert.match(message.email.body, /AI summary: Sam Sample wants a sports massage this week\./);
  assert.equal(JSON.stringify(message).includes(lead.visitor), false);
});

test('a failed email or sheet never loses the lead: it shows "failed", and Retry sends it', async () => {
  await Lead.deleteMany({});
  const notifier = fakeNotifier((channel) => (channel === 'sheet' ? { ok: false, error: 'not allowed' } : { ok: true }));
  const app = createApp({ ai: fakeAi(SUMMARY), notifier, owner: await testOwner() });
  await newVisitor(app).post('/api/leads').send(booking({ email: 'retry@example.com' }));
  await settle(app);

  const { owner } = await signIn(app);
  const [shown] = (await owner.get('/api/owner/leads')).body.leads;
  assert.deepEqual(shown.notify, { email: 'sent', sheet: 'failed' });
  const stored = await Lead.findById(shown.id).lean();
  assert.equal(stored.notify.sheet.error, 'not allowed');

  // The owner fixes the script, then presses Retry for the sheet only.
  notifier.reply = () => ({ ok: true });
  const retried = await owner.post(`/api/owner/leads/${shown.id}/notify`).send({ channel: 'sheet' });
  assert.equal(retried.status, 200);
  assert.deepEqual(retried.body.lead.notify, { email: 'sent', sheet: 'sent' });
  assert.equal((await Lead.findById(shown.id).lean()).notify.sheet.tries, 2);
  assert.equal(notifier.calls.filter((c) => c.channel === 'email').length, 1); // the email wasn't sent twice
});

test('a script that throws, or no script at all, still leaves a saved lead', async () => {
  await Lead.deleteMany({});
  const throwing = createApp({ ai: fakeAi(SUMMARY), notifier: fakeNotifier(() => new Error('boom')) });
  assert.equal((await newVisitor(throwing).post('/api/leads').send(booking({ email: 'boom@example.com' }))).status, 201);
  await settle(throwing);
  const lead = await Lead.findOne({ email: 'boom@example.com' }).lean();
  assert.equal(lead.notify.email.status, 'failed');
  assert.equal(lead.notify.sheet.status, 'failed');

  const none = createApp({ ai: fakeAi(SUMMARY), notifier: null });
  assert.equal((await newVisitor(none).post('/api/leads').send(booking({ email: 'none@example.com' }))).status, 201);
  const quiet = await Lead.findOne({ email: 'none@example.com' }).lean();
  assert.equal(quiet.notify.email.status, 'off');
  assert.equal(quiet.notify.sheet.status, 'off');
});

test('Retry refuses a wrong channel, a channel not set up, a sample, an unknown lead and a stranger', async () => {
  await Lead.deleteMany({});
  const app = createApp({ ai: fakeAi(SUMMARY), notifier: fakeNotifier(undefined, ['sheet']), owner: await testOwner() });
  await newVisitor(app).post('/api/leads').send(booking({ email: 'only-sheet@example.com' }));
  await settle(app);
  const id = String((await Lead.findOne({ email: 'only-sheet@example.com' }).lean())._id);

  const stranger = newVisitor(app);
  assert.equal((await stranger.post(`/api/owner/leads/${id}/notify`).send({ channel: 'sheet' })).status, 401);

  const { owner } = await signIn(app);
  assert.equal((await owner.post(`/api/owner/leads/${id}/notify`).send({ channel: 'sms' })).status, 400);
  const notSetUp = await owner.post(`/api/owner/leads/${id}/notify`).send({ channel: 'email' });
  assert.equal(notSetUp.status, 409);
  assert.equal(notSetUp.body.error, "Lead emails aren't set up.");
  assert.equal((await owner.post('/api/owner/leads/0123456789abcdef01234567/notify').send({ channel: 'sheet' })).status, 404);
  assert.equal((await owner.post('/api/owner/leads/not-an-id/notify').send({ channel: 'sheet' })).status, 404);
  await owner.post('/api/owner/sample-leads');
  const sample = await Lead.findOne({ sample: true }).lean();
  assert.equal((await owner.post(`/api/owner/leads/${sample._id}/notify`).send({ channel: 'sheet' })).status, 404);

  const off = createApp({ ai: fakeAi(SUMMARY), notifier: null, owner: await testOwner() });
  const offOwner = (await signIn(off)).owner;
  assert.equal((await offOwner.post(`/api/owner/leads/${id}/notify`).send({ channel: 'sheet' })).body.error, "The Google Sheet isn't set up.");
  await Lead.deleteMany({});
});

// ---- See what the owner sees ----

test("the buyer sees their own lead exactly as the owner would, next to example leads, through an HttpOnly cookie", async () => {
  await Lead.deleteMany({});
  const app = createApp({ ai: fakeAi(SUMMARY), notifier: fakeNotifier() });
  const visitor = newVisitor(app);
  const res = await visitor.post('/api/leads').send(booking({ name: 'Buyer One', email: 'buyer1@example.com' }));
  const raw = res.headers['set-cookie'].find((c) => c.startsWith('fd_my_lead='));
  assert.match(raw, /HttpOnly/);
  assert.match(raw, /SameSite=Strict/);
  assert.match(raw, /Path=\//);
  await settle(app);

  const view = await newVisitor(app, cookieFrom(res)).get('/api/my-lead');
  assert.equal(view.status, 200);
  assert.equal(view.body.business, 'Maple Lane Physio (Demo)');
  assert.equal(view.body.lead.name, 'Buyer One');
  assert.equal(view.body.lead.score, 'Hot');
  assert.match(view.body.lead.summary, /sports massage/);
  assert.equal(view.body.lead.notify, undefined); // the owner's delivery details stay private
  assert.equal(view.body.examples.length, 6);
  assert.deepEqual(view.body.examples.map((e) => e.id), ['example-1', 'example-2', 'example-3', 'example-4', 'example-5', 'example-6']);
  assert.ok(view.body.examples.every((e) => e.sample));
  // The examples are made for the answer and never saved.
  assert.equal(await Lead.countDocuments({ sample: true }), 0);

  // The cookie holds a token; the lead keeps only its SHA-256.
  const token = cookieFrom(res).split('=')[1];
  const stored = await Lead.findOne({ email: 'buyer1@example.com' }).lean();
  assert.notEqual(stored.viewToken, token);
  assert.match(stored.viewToken, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(view.body).includes(stored.viewToken), false);
  assert.equal(JSON.stringify(view.body).includes(stored.visitor), false);
});

test('a buyer can never see another lead: no cookie, a made-up cookie or an old one all get nothing', async () => {
  await Lead.deleteMany({});
  const app = createApp({ ai: fakeAi(SUMMARY), notifier: null });
  const first = await newVisitor(app).post('/api/leads').send(booking({ name: 'First Buyer', email: 'first@example.com' }));
  const second = await newVisitor(app).post('/api/leads').send(booking({ name: 'Second Buyer', email: 'second@example.com' }));

  assert.equal((await newVisitor(app, cookieFrom(first)).get('/api/my-lead')).body.lead.name, 'First Buyer');
  assert.equal((await newVisitor(app, cookieFrom(second)).get('/api/my-lead')).body.lead.name, 'Second Buyer');

  const none = await newVisitor(app).get('/api/my-lead');
  assert.equal(none.status, 404);
  assert.match(none.body.error, /no booking from this browser/);
  assert.equal((await newVisitor(app, 'fd_my_lead=made-up-token').get('/api/my-lead')).status, 404);
  // The ID in the address does nothing: there is no such address.
  const id = String((await Lead.findOne({ email: 'first@example.com' }).lean())._id);
  assert.equal((await newVisitor(app).get(`/api/my-lead/${id}`)).status, 404);
  assert.equal((await newVisitor(app).get(`/api/my-lead?id=${id}`)).status, 404);

  // After the lead is deleted (24 hours), the old cookie shows nothing.
  await Lead.deleteOne({ email: 'first@example.com' });
  assert.equal((await newVisitor(app, cookieFrom(first)).get('/api/my-lead')).status, 404);

  // A bot that fills the hidden field gets a thank-you and no cookie.
  const bot = await newVisitor(app).post('/api/leads').send(booking({ email: 'bot@example.com', website: 'http://spam.example' }));
  assert.equal(cookieFrom(bot), undefined);
});

test("the buyer's examples follow the business: the hospital shows its own, in its own services", async () => {
  await Lead.deleteMany({});
  const app = createApp({ ai: fakeAi(SUMMARY), notifier: null, profile: CHILDRENS_HOSPITAL });
  const res = await newVisitor(app).post('/api/leads')
    .send({ name: 'Parent Sample', phone: '0300 1234567', service: 'Vaccination visit', timing: 'This week' });
  const view = (await newVisitor(app, cookieFrom(res)).get('/api/my-lead')).body;
  assert.equal(view.place, 'hospital');
  assert.equal(view.examples[0].name, 'Sana A.');
  assert.equal(view.examples[0].service, 'Newborn baby check-up');
  await Lead.deleteMany({});
});

test('on the live site the cookie is Secure and uses the __Host- prefix', () => {
  const live = myLeadCookie(true);
  assert.equal(live.name, '__Host-fd_my_lead');
  assert.equal(live.options.secure, true);
  assert.equal(live.options.httpOnly, true);
  assert.equal(live.options.sameSite, 'strict');
  assert.equal(live.options.path, '/');
  assert.equal(live.options.maxAge, 24 * 60 * 60 * 1000);
  assert.equal(myLeadCookie(false).name, 'fd_my_lead');
});
