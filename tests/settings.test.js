// Day 5 settings: the Gemini tier (Google's terms) and the daily AI limit that caps the bill.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { AI_NOTICE, AI_NOTICE_PAID } from '../server/lib/clinic.js';
import { dailyAiLimit, geminiTier, MAX_AI_CALLS_PER_DAY } from '../server/config.js';
import { fakeAi, newVisitor, signIn, startDatabase, stopDatabase, testOwner } from './helpers.js';

before(startDatabase);
after(stopDatabase);

const ROOT = path.join(import.meta.dirname, '..');

test('GEMINI_TIER is free unless set, and only "free" or "paid" are accepted', () => {
  assert.equal(geminiTier({}), 'free');
  assert.equal(geminiTier({ GEMINI_TIER: ' Paid ' }), 'paid');
  assert.throws(() => geminiTier({ GEMINI_TIER: 'pro' }), /GEMINI_TIER can be "free" or "paid", not "pro"/);
});

test('AI_CALLS_PER_DAY is a whole number from 1 to 300, and 300 when not set', () => {
  assert.equal(MAX_AI_CALLS_PER_DAY, 300);
  assert.equal(dailyAiLimit({}), 300);
  assert.equal(dailyAiLimit({ AI_CALLS_PER_DAY: '' }), 300);
  assert.equal(dailyAiLimit({ AI_CALLS_PER_DAY: ' 100 ' }), 100);
  for (const bad of ['0', '301', '12.5', 'abc', '-5', '1e2x']) {
    assert.throws(() => dailyAiLimit({ AI_CALLS_PER_DAY: bad }), /AI_CALLS_PER_DAY must be a whole number from 1 to 300/, bad);
  }
});

// The app reads its settings once, when it starts, so this starts a real Node process.
function limitWhenStartedWith(value) {
  const env = { ...process.env, AI_CALLS_PER_DAY: value };
  delete env.NODE_ENV;
  return execFileSync(process.execPath, ['--input-type=module', '-e',
    "const { LIMITS } = await import('./server/config.js'); console.log(LIMITS.aiCallsPerDay);"],
  { cwd: ROOT, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

test('started with AI_CALLS_PER_DAY=100, the app stops at 100; a wrong value stops it at startup', () => {
  assert.equal(limitWhenStartedWith('100'), '100');
  assert.throws(() => limitWhenStartedWith('500'), (error) => /AI_CALLS_PER_DAY must be a whole number from 1 to 300, not "500"/.test(error.stderr));
});

test('on the paid tier the chat says what is true for it: no "Google may use them to improve its products"', async () => {
  assert.doesNotMatch(AI_NOTICE_PAID, /improve/);
  assert.match(AI_NOTICE_PAID, /AI assistant, not a person.*demo.*made-up.*Gemini/);

  const paid = createApp({ ai: fakeAi(), tier: 'paid', owner: await testOwner() });
  const page = (await newVisitor(paid).get('/api/clinic')).body;
  assert.ok(page.greeting.endsWith(AI_NOTICE_PAID));
  const { owner } = await signIn(paid);
  assert.equal((await owner.get('/api/owner/knowledge')).body.notice, AI_NOTICE_PAID);

  // With no setting, nothing changes: the free tier's notice, as before.
  const free = (await newVisitor(createApp({ ai: fakeAi() })).get('/api/clinic')).body;
  assert.ok(free.greeting.endsWith(AI_NOTICE));
});
