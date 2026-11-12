// Part 7 checks that weren't covered by earlier parts: logging of the two events worth knowing
// about (OWASP A09), and the attack shapes the OWASP lists name that no earlier test sent.
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { windows } from '../server/lib/counters.js';
import { Counter, Lead } from '../server/models.js';
import { fakeAi, newVisitor, nextMinute, OWNER, setCount, startDatabase, stopDatabase, testOwner } from './helpers.js';

before(startDatabase);
after(stopDatabase);
beforeEach(nextMinute);

test('repeated owner password guessing is logged once, without the IP, the email or the password', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const app = createApp({ ai: fakeAi(), owner: await testOwner() });
  const guesser = newVisitor(app);
  for (let i = 1; i <= 13; i += 1) {
    await guesser.post('/api/owner/login').send({ email: OWNER.email, password: `secret guess ${i}` });
  }
  const lines = warn.mock.calls.map((call) => call.arguments.join(' '));
  const lockouts = lines.filter((line) => line.startsWith('Owner sign-in:'));
  assert.equal(lockouts.length, 1);
  assert.match(lockouts[0], /^Owner sign-in: 10 failed tries from visitor [a-f0-9]{8}; refused for up to an hour\.$/);
  for (const line of lines) {
    assert.doesNotMatch(line, /secret guess|owner@example\.com|203\.0\.113/);
  }
});

test('the AI daily limit is logged once, when the last allowed call is used', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const key = `ai-day:${windows.day()}`;
  await setCount(key, 299);
  try {
    const app = createApp({ ai: fakeAi('We are open on Saturday.') });
    const visitor = newVisitor(app);
    assert.equal((await visitor.post('/api/chat').send({ message: 'Open Saturday?' })).status, 200);
    await nextMinute();
    assert.equal((await newVisitor(app).post('/api/chat').send({ message: 'And Sunday?' })).status, 503);
    const limits = warn.mock.calls.map((c) => c.arguments.join(' ')).filter((l) => l.startsWith('AI daily limit reached'));
    assert.deepEqual(limits, ['AI daily limit reached: 300 calls today. The chat answers again tomorrow.']);
  } finally {
    await Counter.deleteOne({ _id: key });
  }
});

test('database operators sent as values are refused, never run as queries (A05 Injection)', async () => {
  const app = createApp({ ai: fakeAi(), owner: await testOwner() });
  const login = await newVisitor(app).post('/api/owner/login').send({ email: { $ne: null }, password: { $ne: null } });
  assert.equal(login.status, 400);
  const chat = await newVisitor(app).post('/api/chat').send({ message: 'Hi', conversationId: { $ne: null } });
  assert.equal(chat.status, 400);
  const lead = await newVisitor(app).post('/api/leads')
    .send({ name: { $gt: '' }, email: 'x@example.com', service: 'Sports massage', timing: 'This week' });
  assert.equal(lead.status, 400);
  assert.equal(await Lead.countDocuments({ email: 'x@example.com' }), 0);
});

test('a "__proto__" in a request body changes nothing for anyone else', async () => {
  const app = createApp({ ai: fakeAi() });
  await newVisitor(app).post('/api/chat')
    .set('Content-Type', 'application/json')
    .send('{"message":"Hi","__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted":"yes"}}}');
  assert.equal({}.polluted, undefined);
  assert.equal(Object.prototype.polluted, undefined);
});

test('files outside the built page are never served: .env, server code and folder tricks get the page or 404', async () => {
  const app = createApp({ ai: fakeAi() });
  for (const address of ['/.env', '/%2e%2e/.env', '/..%2f.env', '/server/config.js', '/package.json', '/.git/config', '/apps-script/Code.gs']) {
    const res = await newVisitor(app).get(address);
    assert.ok([200, 404].includes(res.status), `${address}: ${res.status}`);
    if (res.status === 200) {
      assert.match(res.headers['content-type'], /text\/html/, address);
      assert.match(res.text, /<div id="root">/, address);
    }
    assert.doesNotMatch(res.text, /GEMINI_API_KEY|NOTIFY_SECRET|OWNER_PASSWORD_HASH|"dependencies"|doPost/, address);
  }
});

test('every answer refuses to be framed, sniffed or sent to other sites as a referrer (A02)', async () => {
  const res = await newVisitor(createApp({ ai: fakeAi() })).get('/');
  assert.match(res.headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.match(res.headers['content-security-policy'], /object-src 'none'/);
  assert.match(res.headers['content-security-policy'], /form-action 'self'/);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['referrer-policy'], 'no-referrer');
  assert.equal(res.headers['x-powered-by'], undefined);
});
