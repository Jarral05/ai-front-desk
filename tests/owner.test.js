// Part 4 checks: only the signed-in owner gets in, sign-in can't be guessed or misused from another
// website, and the dashboard lists, filters, updates, counts and downloads leads safely.
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { Counter, Lead, OwnerSession } from '../server/models.js';
import { csvCell } from '../server/lib/csv.js';
import { statLastDays, visitorId, windows } from '../server/lib/counters.js';
import { ownerCookie, sha256 } from '../server/lib/ownerSession.js';
import { hashPassword, isPasswordHash, verifyPassword } from '../server/lib/passwords.js';
import {
  fakeAi, newVisitor, nextMinute, OWNER, setCount, signIn, startDatabase, stopDatabase, testOwner,
} from './helpers.js';

const SUMMARY = JSON.stringify({ summary: 'Sam wants a sports massage. They would like to come this week.', intent: 'ready_to_book' });
// One fake AI for chat replies and lead summaries: JSON when JSON is asked for.
const ai = fakeAi((call) => (call.json ? SUMMARY : 'We are open on Saturday from 9am to 1pm.'));
const LOGIN = '/api/owner/login';
let app;

before(async () => {
  await startDatabase();
  app = createApp({ ai, owner: await testOwner() });
});
after(stopDatabase);
beforeEach(nextMinute);

const pause = () => new Promise((resolve) => { setTimeout(resolve, 5); });
const tokenOf = (cookie) => cookie.split('=')[1];

function makeLead(name, overrides = {}) {
  return Lead.create({
    name,
    email: `${name.toLowerCase().replace(/\W/g, '')}@example.com`,
    service: 'Sports massage',
    timing: 'This week',
    visitor: 'a-visitor-fingerprint',
    conversationId: '00000000-0000-4000-8000-000000000000',
    score: 'Cold',
    summary: `${name} wants a sports massage.`,
    ...overrides,
  });
}

test('signed out, every owner route refuses and shows nothing, whatever cookie is sent', async () => {
  const lead = await makeLead('Hidden Person');
  const routes = [
    ['get', '/api/owner/leads'], ['get', '/api/owner/leads.csv'], ['patch', `/api/owner/leads/${lead._id}`],
    ['get', '/api/owner/stats'], ['get', '/api/owner/knowledge'], ['put', '/api/owner/knowledge'],
    ['post', '/api/owner/knowledge/pdf'], ['delete', '/api/owner/knowledge/pdf'],
    ['post', '/api/owner/knowledge/reset'], ['get', '/api/owner/anything-else'],
  ];
  for (const cookie of ['', 'fd_owner=made-up', `fd_owner=${'A'.repeat(43)}`, `fd_owner=${sha256('x')}`]) {
    const stranger = newVisitor(app, cookie);
    for (const [method, url] of routes) {
      const res = await stranger[method](url).send({ status: 'Contacted' });
      assert.equal(res.status, 401, `${method} ${url} with "${cookie}"`);
      assert.deepEqual(res.body, { error: 'Please sign in.' });
    }
    assert.deepEqual((await stranger.get('/api/owner/session')).body, { signedIn: false });
  }
  assert.equal((await Lead.findById(lead._id).lean()).status, 'New');
});

test('a wrong email or a wrong password gets the same answer, and no cookie', async () => {
  const answers = [];
  for (const body of [
    { email: 'someone@example.com', password: OWNER.password },
    { email: OWNER.email, password: 'not the right passphrase' },
  ]) {
    const res = await newVisitor(app).post(LOGIN).send(body);
    assert.equal(res.status, 401);
    assert.equal(res.headers['set-cookie'], undefined);
    answers.push(res.body);
  }
  assert.deepEqual(answers[0], { error: "That email and password don't match." });
  assert.deepEqual(answers[1], answers[0]);
  assert.equal((await newVisitor(app).post(LOGIN).send({})).status, 400);
  assert.equal((await newVisitor(app).post(LOGIN).send({ email: OWNER.email, password: 'x'.repeat(201) })).status, 400);
});

test('signing in sets a cookie page scripts cannot read and other websites cannot use; only its fingerprint is stored', async () => {
  const { cookie, res } = await signIn(app);
  assert.deepEqual(res.body, { ok: true, email: OWNER.email });
  const header = res.headers['set-cookie'][0];
  assert.match(header, /^fd_owner=[\w-]{43};/); // 32 random bytes
  assert.match(header, /; HttpOnly/);
  assert.match(header, /; SameSite=Strict/);
  assert.match(header, /; Path=\//);
  assert.match(header, /; Max-Age=28800/); // 8 hours
  assert.doesNotMatch(header, /Secure/); // plain-HTTP testing; production adds it (next test)

  assert.equal(await OwnerSession.countDocuments({ _id: tokenOf(cookie) }), 0);
  assert.equal(await OwnerSession.countDocuments({ _id: sha256(tokenOf(cookie)) }), 1);

  // The email isn't case-sensitive.
  assert.equal((await newVisitor(app).post(LOGIN).send({ email: 'OWNER@Example.COM', password: OWNER.password })).status, 200);
});

test('in production the cookie is Secure and uses the __Host- prefix', () => {
  const { name, options } = ownerCookie(true);
  assert.equal(name, '__Host-fd_owner');
  assert.deepEqual({ ...options }, { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 8 * 3600000 });
});

test('signed in, the dashboard opens; signing out ends the session even if the browser kept the cookie', async () => {
  const { cookie, owner } = await signIn(app);
  assert.deepEqual((await owner.get('/api/owner/session')).body, { signedIn: true, email: OWNER.email });
  assert.equal((await owner.get('/api/owner/leads')).status, 200);

  const out = await owner.post('/api/owner/logout');
  assert.equal(out.status, 200);
  assert.match(out.headers['set-cookie'][0], /^fd_owner=;.*Expires=Thu, 01 Jan 1970/);
  assert.equal((await newVisitor(app, cookie).get('/api/owner/leads')).status, 401);
  assert.equal(await OwnerSession.countDocuments({ _id: sha256(tokenOf(cookie)) }), 0);
});

test('every sign-in makes a new token and ends the one the browser had', async () => {
  const first = await signIn(app);
  const again = await first.owner.post(LOGIN).send({ email: OWNER.email, password: OWNER.password });
  const second = again.headers['set-cookie'][0].split(';')[0];
  assert.notEqual(second, first.cookie);
  assert.equal((await newVisitor(app, first.cookie).get('/api/owner/stats')).status, 401);
  assert.equal((await newVisitor(app, second).get('/api/owner/stats')).status, 200);
});

test('10 sign-in tries an hour from one place; then even the right password waits, and others are unaffected', async () => {
  const guesser = newVisitor(app);
  for (let i = 1; i <= 10; i += 1) {
    assert.equal((await guesser.post(LOGIN).send({ email: OWNER.email, password: `guess number ${i}` })).status, 401, `try ${i}`);
  }
  const blocked = await guesser.post(LOGIN).send({ email: OWNER.email, password: OWNER.password });
  assert.equal(blocked.status, 429);
  assert.match(blocked.body.error, /Too many tries/);
  assert.equal(blocked.headers['set-cookie'], undefined);
  assert.equal((await newVisitor(app).post(LOGIN).send({ email: OWNER.email, password: OWNER.password })).status, 200);

  // A successful sign-in clears that place's count.
  const typo = newVisitor(app);
  await typo.post(LOGIN).send({ email: OWNER.email, password: 'one typo here' });
  assert.equal(await Counter.countDocuments({ _id: `owner-login:${visitorId(typo.ip)}` }), 1);
  await typo.post(LOGIN).send({ email: OWNER.email, password: OWNER.password });
  assert.equal(await Counter.countDocuments({ _id: `owner-login:${visitorId(typo.ip)}` }), 0);
});

test('a session ends after 30 idle minutes or 8 hours, and is moved on while in use', async () => {
  const { cookie, owner } = await signIn(app);
  const id = sha256(tokenOf(cookie));
  const now = Date.now();

  // In use: the idle end moves 30 minutes on.
  await OwnerSession.updateOne({ _id: id }, { $set: { expiresAt: new Date(now + 10 * 60000) } });
  await owner.get('/api/owner/stats');
  const moved = await OwnerSession.findById(id).lean();
  assert.ok(moved.expiresAt - Date.now() > 29 * 60000, 'idle end moved on');

  // ...but never past the absolute end.
  const end = new Date(now + 5 * 60000);
  await OwnerSession.updateOne({ _id: id }, { $set: { endsAt: end, expiresAt: new Date(now + 30000) } });
  await owner.get('/api/owner/stats');
  assert.equal((await OwnerSession.findById(id).lean()).expiresAt.getTime(), end.getTime());

  // Idle too long: refused and deleted, even before MongoDB's once-a-minute clean-up.
  await OwnerSession.updateOne({ _id: id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await owner.get('/api/owner/stats')).status, 401);
  assert.equal(await OwnerSession.countDocuments({ _id: id }), 0);

  // Past the absolute end: refused too.
  const other = await signIn(app);
  await OwnerSession.updateOne({ _id: sha256(tokenOf(other.cookie)) }, { $set: { endsAt: new Date(Date.now() - 1000) } });
  assert.equal((await other.owner.get('/api/owner/stats')).status, 401);

  const indexes = await OwnerSession.collection.indexes();
  assert.equal(indexes.find((index) => index.key.expiresAt === 1).expireAfterSeconds, 0);
});

test('a new password or a new owner email signs out every older session', async () => {
  const { cookie } = await signIn(app);
  const newPassword = createApp({ ai, owner: { email: OWNER.email, passwordHash: await hashPassword('a completely different passphrase') } });
  assert.equal((await newVisitor(newPassword, cookie).get('/api/owner/stats')).status, 401);

  const { cookie: another } = await signIn(app);
  const newEmail = createApp({ ai, owner: { ...(await testOwner()), email: 'new-owner@example.com' } });
  assert.equal((await newVisitor(newEmail, another).get('/api/owner/stats')).status, 401);
});

test('without owner settings, sign-in says so and every owner route still refuses', async () => {
  const bare = createApp({ ai, owner: { email: '', passwordHash: '' } });
  const res = await newVisitor(bare).post(LOGIN).send({ email: OWNER.email, password: OWNER.password });
  assert.equal(res.status, 503);
  assert.match(res.body.error, /isn't set up yet/);
  assert.equal((await newVisitor(bare).get('/api/owner/leads')).status, 401);
});

test('a request started by another website is refused, even with the owner cookie', async () => {
  const { cookie } = await signIn(app);
  const lead = await makeLead('Cross Site');
  const res = await request(app).patch(`/api/owner/leads/${lead._id}`)
    .set('Cookie', cookie).set('Origin', 'https://evil.example').send({ status: 'Contacted' });
  assert.equal(res.status, 403);
  assert.equal((await Lead.findById(lead._id).lean()).status, 'New');

  const login = await request(app).post(LOGIN).set('Origin', 'https://evil.example')
    .send({ email: OWNER.email, password: OWNER.password });
  assert.equal(login.status, 403);
  assert.equal(login.headers['set-cookie'], undefined);

  // "null" is what sandboxed frames and saved files send: refused too.
  const nullOrigin = await request(app).post('/api/owner/logout').set('Cookie', cookie).set('Origin', 'null');
  assert.equal(nullOrigin.status, 403);
  // The app's own page (same host) is allowed.
  const own = await request(app).patch(`/api/owner/leads/${lead._id}`)
    .set('Host', 'frontdesk.test').set('Origin', 'http://frontdesk.test')
    .set('Cookie', cookie).send({ status: 'Contacted' });
  assert.equal(own.status, 200);
});

test('if a dashboard count fails to save, the chat and the lead are still saved', async (t) => {
  // Make every "stat-" counter write fail, as if that one database write broke.
  const original = Counter.findOneAndUpdate.bind(Counter);
  t.mock.method(Counter, 'findOneAndUpdate', (filter, ...rest) => {
    if (String(filter._id).startsWith('stat-')) throw new Error('write failed');
    return original(filter, ...rest);
  });
  const quietLog = t.mock.method(console, 'error', () => {});

  const visitor = newVisitor(app);
  const chat = await visitor.post('/api/chat').send({ message: 'Are you open on Saturday?' });
  assert.equal(chat.status, 200);
  await nextMinute();
  const res = await visitor.post('/api/leads').send({ name: 'Still Saved', email: 'still@example.com', service: 'Sports massage', timing: 'This week' });
  assert.equal(res.status, 201);
  assert.equal((await Lead.findOne({ email: 'still@example.com' }).lean()).score, 'Hot');
  assert.ok(quietLog.mock.calls.some((call) => call.arguments[0] === 'Could not count a stat:'));
});

test('the dashboard lists leads newest first, filters by score, and never shows the visitor fingerprint', async () => {
  await Lead.deleteMany({});
  await makeLead('First', { score: 'Cold' });
  await pause();
  await makeLead('Second', { score: 'Hot', scoreReasons: ['Wants a time this week (+2)'] });
  await pause();
  await makeLead('Third', { score: 'Hot' });
  const { owner } = await signIn(app);

  const all = (await owner.get('/api/owner/leads')).body.leads;
  assert.deepEqual(all.map((lead) => lead.name), ['Third', 'Second', 'First']);
  assert.deepEqual(Object.keys(all[1]).sort(), [
    'email', 'id', 'message', 'name', 'phone', 'receivedAt', 'sample', 'score', 'scoreReasons', 'service', 'status', 'summary', 'timing',
  ]);
  assert.deepEqual(all[1].scoreReasons, ['Wants a time this week (+2)']);

  const hot = (await owner.get('/api/owner/leads?score=Hot')).body.leads;
  assert.deepEqual(hot.map((lead) => lead.name), ['Third', 'Second']);
  assert.equal((await owner.get('/api/owner/leads?score=Boiling')).status, 400);
  assert.equal((await owner.get('/api/owner/leads?score=Hot&score=Cold')).status, 400);
  // A database operator in the address is just an unknown word, never a query.
  const sneaky = await owner.get('/api/owner/leads?score[$ne]=Hot');
  assert.equal(sneaky.status, 200);
  assert.equal(sneaky.body.leads.length, 3);
});

test('the owner marks a lead Contacted, and back to New', async () => {
  const lead = await makeLead('Status Person');
  const { owner } = await signIn(app);
  const done = await owner.patch(`/api/owner/leads/${lead._id}`).send({ status: 'Contacted' });
  assert.equal(done.status, 200);
  assert.equal(done.body.lead.status, 'Contacted');
  assert.equal((await Lead.findById(lead._id).lean()).status, 'Contacted');
  assert.equal((await owner.patch(`/api/owner/leads/${lead._id}`).send({ status: 'New' })).body.lead.status, 'New');

  assert.equal((await owner.patch(`/api/owner/leads/${lead._id}`).send({ status: 'Deleted' })).status, 400);
  assert.equal((await owner.patch('/api/owner/leads/not-an-id').send({ status: 'New' })).status, 404);
  assert.equal((await owner.patch('/api/owner/leads/0123456789abcdef01234567').send({ status: 'New' })).status, 404);
});

test("the last 7 days' numbers count new chats, leads and Hot leads", async () => {
  const { owner } = await signIn(app);
  const start = (await owner.get('/api/owner/stats')).body;

  const visitor = newVisitor(app);
  const chat = await visitor.post('/api/chat').send({ message: 'Are you open on Saturday?' });
  await nextMinute();
  // A second message in the same chat isn't a new chat.
  await visitor.post('/api/chat').send({ message: 'And on Sunday?', conversationId: chat.body.conversationId });
  await nextMinute();
  // This week + a named service + ready to book = Hot.
  await visitor.post('/api/leads').send({ name: 'Sam Sample', email: 'sam@example.com', service: 'Sports massage', timing: 'This week' });
  await nextMinute();
  // Later + "Not sure" + ready to book = Cold.
  await newVisitor(app).post('/api/leads').send({ name: 'Lee Later', email: 'lee@example.com', service: 'Not sure', timing: 'Later' });

  const end = (await owner.get('/api/owner/stats')).body;
  assert.equal(end.days, 7);
  assert.equal(end.chats - start.chats, 1);
  assert.equal(end.leads - start.leads, 2);
  assert.equal(end.hot - start.hot, 1);
  assert.deepEqual(end.samples, { leads: 0, hot: 0 });
});

test('the 7-day numbers add up the last 7 daily counters, which keep no personal details and last 8 days', async () => {
  const day = (n) => windows.day(new Date(Date.now() - n * 86400000));
  await setCount(`stat-test:${day(0)}`, 2);
  await setCount(`stat-test:${day(6)}`, 3);
  await setCount(`stat-test:${day(7)}`, 100); // 8 days ago: not counted
  assert.equal(await statLastDays('test', 7), 5);

  const counter = await Counter.findById(`stat-leads:${day(0)}`).lean();
  const days = (counter.expiresAt - Date.now()) / 86400000;
  assert.ok(days > 7.9 && days <= 8, `kept ${days} days`);
  assert.deepEqual(Object.keys(counter).sort(), ['_id', 'count', 'expiresAt']);
});

test('the CSV download is a file, with spreadsheet formulas made harmless and quotes escaped', async () => {
  await Lead.deleteMany({});
  await makeLead('=HYPERLINK("http://evil.example","Click me")', {
    email: 'csv@example.com',
    phone: '+1 555 0100',
    message: '@SUM(1+1)\nsecond line',
    scoreReasons: ['Named a service: Sports massage (+1)', 'Ready to book (+1)'],
    summary: 'Wants a massage, "soon".',
  });
  const { owner } = await signIn(app);
  const res = await owner.get('/api/owner/leads.csv');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /^text\/csv; charset=utf-8/);
  // Express only adds quotes around a file name when it needs them.
  assert.match(res.headers['content-disposition'], /^attachment; filename=maple-lane-leads-\d{4}-\d{2}-\d{2}\.csv$/);

  const text = res.text;
  assert.ok(text.startsWith('﻿"Received (UTC)","Name","Email"'), 'starts with the header row');
  assert.ok(text.includes('"\'=HYPERLINK(""http://evil.example"",""Click me"")"'), 'formula name neutralised');
  assert.ok(text.includes('"\'+1 555 0100"'), 'phone starting with + neutralised');
  assert.ok(text.includes('"\'@SUM(1+1)\nsecond line"'), 'message starting with @ neutralised');
  assert.ok(text.includes('"Named a service: Sports massage (+1); Ready to book (+1)"'));
  assert.ok(text.includes('"Wants a massage, ""soon""."'), 'inner quotes doubled');
  assert.match(text, /"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"/);

  assert.equal((await owner.get('/api/owner/leads.csv?score=Hot')).text, '﻿"Received (UTC)","Name","Email","Phone","Service","When","Message","Score","Why this score","AI summary","Status"\r\n');
});

test('every risky first character gets a quote mark in front; ordinary text is left alone', () => {
  for (const risky of ['=1+1', '+1', '-1', '@x', '\tx', '\rx', '\nx', '  =1', '＝1', '＋1', '－1', '＠x']) {
    assert.ok(csvCell(risky).startsWith('"\''), JSON.stringify(risky));
  }
  for (const safe of ['Sam', 'sam@example.com', '1-2', '', 'a "quote"']) {
    assert.equal(csvCell(safe), `"${safe.replaceAll('"', '""')}"`);
  }
  assert.equal(csvCell(null), '""');
});

test("the owner's password is kept as a salted scrypt hash that can't be turned back or faked", async () => {
  const hash = await hashPassword('correct horse battery staple');
  assert.match(hash, /^scrypt:32768:8:3:[\w-]{22}:[\w-]{43}$/);
  assert.ok(!hash.includes('$'), 'no $ signs to break .env files');
  assert.notEqual(hash, await hashPassword('correct horse battery staple'), 'a new salt every time');
  assert.equal(await verifyPassword('correct horse battery staple', hash), true);
  assert.equal(await verifyPassword('correct horse battery stapler', hash), false);

  // The same word typed with a separate accent mark still matches (Unicode NFKC).
  const accented = await hashPassword('café au lait every morning');
  assert.equal(await verifyPassword('café au lait every morning', accented), true);

  const tooCostly = hash.replace(':32768:8:', ':1048576:8:');
  for (const bad of ['', 'my-password', '$2b$12$abcdefghijklmnopqrstuv', 'scrypt:1024:8:1:aaaa:bbbb', tooCostly]) {
    assert.equal(isPasswordHash(bad), false, bad);
    assert.equal(await verifyPassword('anything', bad), false, bad);
  }
});
