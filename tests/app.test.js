// Part 1 checks: the API answers, the clinic facts are right, and the safety headers are on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { checkProductionSettings } from '../server/config.js';
import { DEMO_CLINIC, publicClinic } from '../server/lib/clinic.js';

const app = createApp();

test('the health check answers ok', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
});

test('the clinic API returns the demo clinic and its four services', async () => {
  const res = await request(app).get('/api/clinic');
  assert.equal(res.status, 200);
  assert.equal(res.body.name, 'Maple Lane Physio (Demo)');
  assert.equal(res.body.services.length, 4);
  assert.deepEqual(res.body.services[0], { name: 'First assessment', minutes: 60, price: 80 });
  assert.ok(res.body.hours.includes('Sunday: closed'));
});

test('the clinic name always says it is a demo', () => {
  assert.match(DEMO_CLINIC.name, /\(Demo\)$/);
});

test('changing the copy sent to a page cannot change the demo facts', () => {
  const copy = publicClinic();
  copy.services[0].price = 1;
  copy.hours.push('Sunday: open');
  assert.equal(DEMO_CLINIC.services[0].price, 80);
  assert.equal(DEMO_CLINIC.hours.length, 3);
});

test('an unknown API address gets a JSON 404, not the web page', async () => {
  const res = await request(app).get('/api/nothing-here');
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { error: 'Not found' });
});

test('API answers are never cached', async () => {
  const res = await request(app).get('/api/clinic');
  assert.equal(res.headers['cache-control'], 'no-store, private');
});

test('every answer carries the safety headers', async () => {
  const res = await request(app).get('/api/health');
  const csp = res.headers['content-security-policy'];
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(res.headers['x-robots-tag'], 'noindex, nofollow');
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['x-powered-by'], undefined);
});

test('broken JSON gets a short 400, never a stack trace', async () => {
  const res = await request(app)
    .post('/api/health')
    .set('Content-Type', 'application/json')
    .send('{"broken":');
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { error: 'Invalid request' });
});

test('a body over 20 KB is refused', async () => {
  const res = await request(app)
    .post('/api/health')
    .set('Content-Type', 'application/json')
    .send(JSON.stringify({ text: 'x'.repeat(25 * 1024) }));
  assert.equal(res.status, 413);
});

test('any page address gets the web page, which is never cached and stays out of search', async () => {
  const res = await request(app).get('/some/page');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.match(res.text, /<title>Maple Lane Physio \(Demo\)<\/title>/);
  assert.match(res.text, /<meta name="robots" content="noindex, nofollow"/);
  assert.equal(res.headers['cache-control'], 'no-cache');
});

test('production refuses to start without its database and address settings', () => {
  assert.throws(() => checkProductionSettings({ NODE_ENV: 'production' }), /MONGODB_URI must be set/);
  assert.throws(
    () => checkProductionSettings({ NODE_ENV: 'production', MONGODB_URI: 'mongodb://x' }),
    /PUBLIC_URL must be set/,
  );
  assert.throws(
    () => checkProductionSettings({ NODE_ENV: 'production', MONGODB_URI: 'mongodb://x', PUBLIC_URL: 'https://x' }),
    /GEMINI_API_KEY must be set/,
  );
  assert.doesNotThrow(() => checkProductionSettings({ NODE_ENV: 'development' }));
});
