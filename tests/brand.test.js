// Looks and sample leads: each business's colours and logo, and a dashboard that isn't empty when
// it's shown to a buyer.
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { brandProblem, contrast, initials, logoType, tint } from '../server/lib/brand.js';
import { CHILDRENS_HOSPITAL, profileFromFile, PROFILES } from '../server/lib/profiles.js';
import { sampleLeadDocs } from '../server/lib/samples.js';
import { Lead } from '../server/models.js';
import { fakeAi, newVisitor, nextMinute, signIn, startDatabase, stopDatabase, testOwner } from './helpers.js';

before(startDatabase);
after(stopDatabase);
beforeEach(nextMinute);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'front-desk-brand-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
function profileFile(name, content) {
  const file = path.join(tmp, name);
  fs.writeFileSync(file, JSON.stringify(content));
  return file;
}
const PRIVATE = {
  name: 'Sample City Hospital',
  tagline: 'A hospital used only in this test.',
  services: [{ name: 'Check-up (sample fee)', minutes: 15, price: 1000 }],
  hours: ['Open 24 hours'],
  facts: ['Fees on this page are samples.'],
  greeting: 'Welcome. I can answer questions about timings and fees.',
};
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 7)]);

// ---- Colours, initials and a logo (lib/brand.js) ----

test('every built-in colour set can be read, and the page gets the colours and the initials', async () => {
  for (const profile of Object.values(PROFILES)) {
    assert.equal(brandProblem(profile.brand), null, profile.id);
  }
  assert.equal(initials("Nanhay Qadam Children's Hospital (Demo)"), 'NQ');
  assert.equal(initials('Maple Lane Physio (Demo)'), 'ML');
  assert.equal(initials('Sample City Hospital'), 'SC');

  const page = (await newVisitor(createApp({ ai: fakeAi(), profile: CHILDRENS_HOSPITAL })).get('/api/clinic')).body;
  assert.deepEqual(page.brand, { dark: '#173a5e', accent: '#c2410c', light: '#fde68a' });
  assert.equal(page.initials, 'NQ');
  assert.equal(page.logo, false);
  // The physio clinic keeps the colours it always had.
  const clinic = (await newVisitor(createApp({ ai: fakeAi() })).get('/api/clinic')).body;
  assert.deepEqual(clinic.brand, { dark: '#0f1e33', accent: '#0f766e', light: '#5eead4' });
});

test('a private profile can set its own colours, but not ones that are too hard to read', () => {
  const own = { dark: '#1e3a8a', accent: '#be185d', light: '#fbcfe8' };
  assert.deepEqual(profileFromFile(profileFile('brand.json', { ...PRIVATE, brand: own })).brand, own);
  // Without its own colours it takes the children's hospital ones.
  assert.deepEqual(profileFromFile(profileFile('plain.json', PRIVATE)).brand, CHILDRENS_HOSPITAL.brand);

  assert.throws(
    () => profileFromFile(profileFile('pale.json', { ...PRIVATE, brand: { ...own, dark: '#9ca3af' } })),
    /brand: the dark colour #9ca3af is too hard to read for white text .* needs at least 4\.5/,
  );
  assert.throws(
    () => profileFromFile(profileFile('yellow.json', { ...PRIVATE, brand: { ...own, accent: '#facc15' } })),
    /brand: the accent colour #facc15 is too hard to read/,
  );
  assert.throws(
    () => profileFromFile(profileFile('word.json', { ...PRIVATE, brand: { ...own, dark: 'blue' } })),
    /brand\.dark: Use a colour like/,
  );
  assert.ok(contrast('#000000', '#ffffff') > 20.9);
  // The pale fill is worked out the same way as the page's color-mix().
  assert.equal(tint('#c2410c'), '#fbf2ee');
  assert.equal(tint('#0f766e'), '#eef5f5');
  assert.equal(contrast('#123456', '#123456'), 1);
});

test("a private profile's logo is served as the picture it really is", async () => {
  fs.writeFileSync(path.join(tmp, 'logo.png'), PNG);
  const profile = profileFromFile(profileFile('with-logo.json', { ...PRIVATE, logo: 'logo.png' }));
  assert.equal(profile.logo.type, 'image/png');

  const app = createApp({ ai: fakeAi(), profile });
  assert.equal((await newVisitor(app).get('/api/clinic')).body.logo, true);
  const res = await newVisitor(app).get('/api/logo').buffer(true);
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /^image\/png/);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.deepEqual(Buffer.from(res.body), PNG);

  // No logo: a JSON 404, as for any unknown API address.
  const none = await newVisitor(createApp({ ai: fakeAi(), profile: CHILDRENS_HOSPITAL })).get('/api/logo');
  assert.equal(none.status, 404);
  assert.deepEqual(none.body, { error: 'Not found' });
});

test('a logo that is SVG, not a picture, too big, missing or outside the folder stops the app', () => {
  fs.writeFileSync(path.join(tmp, 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  fs.writeFileSync(path.join(tmp, 'fake.png'), 'not really a picture');
  fs.writeFileSync(path.join(tmp, 'huge.png'), Buffer.concat([PNG, Buffer.alloc(300 * 1024)]));
  fs.writeFileSync(path.join(os.tmpdir(), 'front-desk-outside.png'), PNG);
  after(() => fs.rmSync(path.join(os.tmpdir(), 'front-desk-outside.png'), { force: true }));
  const withLogo = (logo) => () => profileFromFile(profileFile(`logo-${logo.replace(/\W/g, '')}.json`, { ...PRIVATE, logo }));

  assert.throws(withLogo('logo.svg'), /logo: use a PNG, JPEG or WebP picture\. SVG isn't allowed/);
  assert.throws(withLogo('fake.png'), /logo: use a PNG, JPEG or WebP/);
  assert.throws(withLogo('huge.png'), /logo: the file can be up to 300 KB/);
  assert.throws(withLogo('nothing.png'), /logo: "nothing\.png" can't be read/);
  assert.throws(withLogo('../front-desk-outside.png'), /logo: put the logo in the same folder/);
  assert.throws(withLogo('sub/logo.png'), /logo: put the logo in the same folder/);
});

test('the real type comes from the first bytes: PNG, JPEG and WebP only', () => {
  assert.equal(logoType(PNG), 'image/png');
  assert.equal(logoType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), 'image/jpeg');
  assert.equal(logoType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1')), 'image/webp');
  assert.equal(logoType(Buffer.from('RIFF\0\0\0\0WAVEfmt ', 'latin1')), null);
  assert.equal(logoType(Buffer.from('GIF89a')), null);
  assert.equal(logoType(Buffer.alloc(0)), null);
});

// ---- Sample leads for showing the dashboard (lib/samples.js) ----

test('the owner can fill the dashboard with sample leads, scored by the usual rules and marked as samples', async () => {
  await Lead.deleteMany({});
  const app = createApp({ ai: fakeAi(), owner: await testOwner(), profile: CHILDRENS_HOSPITAL });
  const { owner } = await signIn(app);

  const empty = (await owner.get('/api/owner/leads')).body;
  assert.equal(empty.samplesAvailable, true);
  assert.equal(empty.leads.length, 0);

  const filled = await owner.post('/api/owner/sample-leads');
  assert.equal(filled.status, 201);
  assert.deepEqual(filled.body, { count: 6 });
  const { leads } = (await owner.get('/api/owner/leads')).body;
  assert.equal(leads.length, 6);
  assert.ok(leads.every((lead) => lead.sample === true));
  // Newest first, at their own made-up times.
  assert.equal(leads[0].name, 'Sana A.');
  assert.equal(leads[5].name, 'Bilal H.');
  assert.ok(new Date(leads[0].receivedAt) > new Date(leads[5].receivedAt));
  // The hospital's own services, and scores worked out by lib/score.js.
  assert.equal(leads[0].service, 'Newborn baby check-up');
  assert.equal(leads[0].score, 'Hot');
  assert.deepEqual(leads[0].scoreReasons, [
    'Wants a time this week (+2)', 'Named a service: Newborn baby check-up (+1)', 'Ready to book (+1)',
  ]);
  const byName = Object.fromEntries(leads.map((lead) => [lead.name, lead]));
  assert.equal(byName['Usman B.'].score, 'Warm');
  assert.equal(byName['Rabia M.'].service, 'Not sure');
  assert.equal(byName['Rabia M.'].score, 'Cold');

  // The numbers at the top count them, separately from the real ones.
  assert.deepEqual((await owner.get('/api/owner/stats')).body.samples, { leads: 6, hot: 3 });

  // Filling again replaces them: still 6, never 12.
  await owner.post('/api/owner/sample-leads');
  assert.equal(await Lead.countDocuments({ sample: true }), 6);
  // Like every lead, they delete themselves within 24 hours.
  const stored = await Lead.findOne({ sample: true }).lean();
  assert.ok(stored.expiresAt - Date.now() <= 24 * 60 * 60 * 1000);
  assert.equal(stored.visitor, 'sample');

  // The CSV is named after the hospital.
  const csv = await owner.get('/api/owner/leads.csv');
  assert.match(csv.headers['content-disposition'], /filename="?childrens-hospital-leads-\d{4}-\d{2}-\d{2}\.csv"?$/);
});

test('removing sample leads never touches a real lead, and only the signed-in owner can do either', async () => {
  await Lead.deleteMany({});
  const app = createApp({ ai: null, owner: await testOwner(), profile: CHILDRENS_HOSPITAL });
  const real = await newVisitor(app).post('/api/leads')
    .send({ name: 'Real Parent', phone: '0300 1234567', service: 'Vaccination visit', timing: 'This week' });
  assert.equal(real.status, 201);

  const stranger = newVisitor(app);
  assert.equal((await stranger.post('/api/owner/sample-leads')).status, 401);
  assert.equal((await stranger.delete('/api/owner/sample-leads')).status, 401);
  assert.equal(await Lead.countDocuments({ sample: true }), 0);

  const { owner } = await signIn(app);
  await owner.post('/api/owner/sample-leads');
  const removed = await owner.delete('/api/owner/sample-leads');
  assert.deepEqual(removed.body, { count: 6 });
  const left = (await owner.get('/api/owner/leads')).body.leads;
  assert.deepEqual(left.map((lead) => [lead.name, lead.sample]), [['Real Parent', false]]);
  await Lead.deleteMany({});
});

test("sample leads follow a private profile's services, and the physio clinic has its own", async () => {
  const docs = sampleLeadDocs(CHILDRENS_HOSPITAL.sampleLeads, ['Check-up (sample fee)']);
  assert.ok(docs.every((doc) => ['Check-up (sample fee)', 'Not sure'].includes(doc.service)));
  assert.ok(sampleLeadDocs(CHILDRENS_HOSPITAL.sampleLeads, []).every((doc) => doc.service === 'Not sure'));

  await Lead.deleteMany({});
  const app = createApp({ ai: fakeAi(), owner: await testOwner() });
  const { owner } = await signIn(app);
  await owner.post('/api/owner/sample-leads');
  const { leads } = (await owner.get('/api/owner/leads')).body;
  assert.equal(leads[0].name, 'Olivia P.');
  assert.equal(leads[0].service, 'First assessment');
  const csv = await owner.get('/api/owner/leads.csv');
  assert.match(csv.headers['content-disposition'], /filename="?maple-lane-leads-/);
  await Lead.deleteMany({});
});
