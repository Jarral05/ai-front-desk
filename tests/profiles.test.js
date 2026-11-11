// Profile checks: the same app can show a children's hospital instead of the physio clinic, the
// first profile is untouched, and one profile's rules, facts and saved edits never leak into another.
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { clinicFactsText, DEMO_CLINIC } from '../server/lib/clinic.js';
import { CHILDRENS_HOSPITAL, loadProfile, profileFromFile, PROFILES } from '../server/lib/profiles.js';
import { chatRules, leadRules, notSure } from '../server/lib/prompts.js';
import { EMERGENCY_REPLY, looksLikeEmergency, matchesAny } from '../server/lib/safety.js';
import { Knowledge, Lead } from '../server/models.js';
import { fakeAi, newVisitor, nextMinute, signIn, startDatabase, stopDatabase, testOwner } from './helpers.js';

before(startDatabase);
after(stopDatabase);
beforeEach(nextMinute);

const hospitalApp = (options = {}) => createApp({ ai: fakeAi(), profile: CHILDRENS_HOSPITAL, ...options });

// A private profile file, written to the computer's temporary folder for one test.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'front-desk-profile-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
function profileFile(name, content) {
  const file = path.join(tmp, name);
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
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

test('with no setting the app is still Maple Lane Physio, in dollars, asking for an email', async () => {
  assert.equal(loadProfile({}), DEMO_CLINIC);
  const res = await newVisitor(createApp({ ai: fakeAi() })).get('/api/clinic');
  assert.equal(res.body.name, 'Maple Lane Physio (Demo)');
  assert.equal(res.body.currency, '$');
  assert.equal(res.body.contact, 'email');
  assert.equal(res.body.place, 'clinic');
  assert.match(res.body.demoNote, /made-up clinic/);
  assert.match(clinicFactsText(), /^Clinic name: Maple Lane Physio \(Demo\)\n/);
  assert.match(clinicFactsText(), /First assessment: 60 minutes, \$80/);
});

test('CLINIC_PROFILE chooses a built-in profile, and a wrong name stops the app with the choices', () => {
  assert.equal(loadProfile({ CLINIC_PROFILE: 'childrens-hospital' }), CHILDRENS_HOSPITAL);
  assert.throws(
    () => loadProfile({ CLINIC_PROFILE: 'dental' }),
    /CLINIC_PROFILE "dental" isn't known\. Choose one of: maple-lane, childrens-hospital\./,
  );
  // A name such as "constructor" exists on every object; it must not count as a profile.
  assert.throws(() => loadProfile({ CLINIC_PROFILE: 'constructor' }), /isn't known/);
});

test('every built-in profile says it is a demo, in its name and on its page', () => {
  for (const profile of Object.values(PROFILES)) {
    assert.match(profile.name, /\(Demo\)$/, profile.id);
    assert.match(profile.demoNote, /^Demo website for a made-up/, profile.id);
    assert.match(profile.about, /made up for a demo/, profile.id);
  }
});

test("the hospital page shows the hospital's facts, in rupees, asking for a phone number", async () => {
  const res = await newVisitor(hospitalApp()).get('/api/clinic');
  assert.equal(res.status, 200);
  assert.equal(res.body.name, "Nanhay Qadam Children's Hospital (Demo)");
  assert.equal(res.body.currency, 'Rs ');
  assert.equal(res.body.contact, 'phone');
  assert.equal(res.body.place, 'hospital');
  assert.equal(res.body.servicesTitle, 'Check-ups and fees');
  assert.deepEqual(res.body.services[0], { name: 'Child specialist check-up', minutes: 15, price: 1500 });
  assert.match(res.body.greeting, /AI assistant, not a person.*demo.*Gemini/);
});

test("the hospital's AI rules name the hospital, rupees and Urdu, and nothing from the physio clinic", async () => {
  const ai = fakeAi('The child specialist check-up is Rs 1500.');
  const res = await newVisitor(hospitalApp({ ai })).post('/api/chat').send({ message: 'Child specialist ki fee kitni hai?' });
  assert.equal(res.status, 200);
  const { system } = ai.calls[0];
  assert.match(system, /website of a children's hospital\./);
  assert.match(system, /Hospital name: Nanhay Qadam Children's Hospital \(Demo\)/);
  assert.match(system, /Services and prices \(Pakistani rupees\):/);
  assert.match(system, /- Child specialist check-up: 15 minutes, Rs 1500/);
  assert.match(system, /8\. Reply in the language the visitor writes in: English, Urdu \(in Urdu script\) or\s+Roman Urdu/);
  assert.match(system, /Pakistani Urdu/);
  assert.ok(system.includes(notSure(CHILDRENS_HOSPITAL)));
  assert.match(system, /Never give medical advice/);
  assert.match(system, /booking a check-up with a child specialist/);
  assert.doesNotMatch(system, /physio|Maple Lane|first assessment|US dollars/i);
});

test("the first profile's AI rules are unchanged: no Urdu rule, no hospital words", () => {
  const rules = chatRules();
  assert.match(rules, /website of a physiotherapy clinic\.\nThe clinic is made up for a demo\./);
  assert.match(rules, /suggest booking a first assessment\./);
  assert.match(rules, /tell them to contact emergency services now\./);
  assert.doesNotMatch(rules, /Urdu|hospital|rupees|\n8\. /);
  assert.match(leadRules(), /^You help a physiotherapy clinic owner read/);
  assert.doesNotMatch(leadRules(), /English/);
  assert.match(leadRules(CHILDRENS_HOSPITAL), /children's hospital owner[\s\S]*Always write it in English\./);
});

test("a parent's emergency words, in English, Roman Urdu or Urdu, get the hospital's fixed answer without the AI", async () => {
  const ai = fakeAi();
  const app = hospitalApp({ ai });
  const emergencies = [
    'my baby is having a fit',
    'he swallowed a coin',
    'her lips are blue',
    'bachay ko saans nahi aa rahi',
    'beta behosh ho gaya hai',
    'bachi ko jhatke lag rahe hain',
    'بچہ بے ہوش ہے',
    'بچے کو سانس نہیں آ رہی',
    'I have chest pain', // the standard list still counts
  ];
  for (const message of emergencies) {
    await nextMinute();
    const res = await newVisitor(app).post('/api/chat').send({ message });
    assert.equal(res.status, 200, message);
    assert.equal(res.body.reply, CHILDRENS_HOSPITAL.emergencyReply, message);
  }
  assert.equal(ai.calls.length, 0);
  assert.match(CHILDRENS_HOSPITAL.emergencyReply, /nearest\s+hospital emergency room now/);
  assert.match(CHILDRENS_HOSPITAL.emergencyReply, /ایمرجنسی/);
});

test('ordinary hospital questions are not treated as emergencies, and the clinic keeps its own list', () => {
  const extra = CHILDRENS_HOSPITAL.emergencyPatterns;
  for (const text of [
    'Child specialist ki fee kitni hai?',
    'Which time fits best for a vaccination visit?',
    'My son has had a fever since yesterday',
    'Is the pharmacy open at night?',
    'bachay ko bukhar hai, doctor kab bethte hain?',
  ]) {
    assert.ok(!looksLikeEmergency(text, extra), text);
  }
  // The same words on the physio clinic's page go to the AI as before.
  assert.ok(!looksLikeEmergency('he swallowed a coin'));
  assert.ok(looksLikeEmergency('he swallowed a coin', extra));
});

test("a medicine or dose question gets the hospital's fixed refusal in both languages, without the AI", async () => {
  const ai = fakeAi();
  const app = hospitalApp({ ai });
  const questions = [
    'Mere bachay ko 2 din se bukhar hai, kaun si dawai doon?',
    'My daughter has a cough. Which syrup should I give her?',
    'Can I give paracetamol to a 2 year old?',
    'How much panadol for a baby?',
    'bukhar ki dawa dein ya nahi',
    'What is the dose of brufen?',
    'میرے بیٹے کو بخار ہے، کون سی دوا دوں؟',
    'بخار کی خوراک کتنی ہے',
  ];
  for (const message of questions) {
    const res = await newVisitor(app).post('/api/chat').send({ message });
    assert.equal(res.status, 200, message);
    assert.equal(res.body.reply, CHILDRENS_HOSPITAL.adviceReply, message);
  }
  assert.equal(ai.calls.length, 0);
  assert.match(CHILDRENS_HOSPITAL.adviceReply, /can't advise on medicines, doses or symptoms/);
  assert.match(CHILDRENS_HOSPITAL.adviceReply, /مشورہ نہیں/);

  // It works with the AI switched off too, and an emergency still comes first.
  const off = hospitalApp({ ai: null });
  assert.equal((await newVisitor(off).post('/api/chat').send({ message: 'kaun si dawai doon?' })).body.reply, CHILDRENS_HOSPITAL.adviceReply);
  const both = await newVisitor(off).post('/api/chat').send({ message: 'he swallowed tablets, which medicine should I give?' });
  assert.equal(both.body.reply, CHILDRENS_HOSPITAL.emergencyReply);
});

test('questions about the pharmacy, fees and vaccines still go to the AI, and the clinic has no such list', async () => {
  const list = CHILDRENS_HOSPITAL.advicePatterns;
  for (const text of [
    'Is the pharmacy open at night?',
    'dawai ki dukaan kab khulti hai?',
    'Does the vaccination fee include the vaccine?',
    'Child specialist ki fee kitni hai?',
    'Do you have medicine for sale at the hospital?',
    'فارمیسی کب کھلتی ہے؟',
  ]) {
    assert.ok(!matchesAny(text, list), text);
  }
  // On the physio clinic's page the same kind of question goes to the AI, as it always did.
  const ai = fakeAi("I can't give medical advice.");
  const res = await newVisitor(createApp({ ai })).post('/api/chat').send({ message: 'Which medicine should I take for back pain?' });
  assert.equal(res.body.reply, "I can't give medical advice.");
  assert.equal(ai.calls.length, 1);
});

test("the hospital's 'not sure' sentence carries English and Urdu, and an empty AI answer falls back to it", async () => {
  assert.match(notSure(CHILDRENS_HOSPITAL), /^I'm not sure about that\. You can ask the hospital directly with the booking form\.\n.*یقین نہیں/);
  assert.equal(notSure(), "I'm not sure about that. You can ask the clinic directly with the booking form.");
  const res = await newVisitor(hospitalApp({ ai: fakeAi('   ') })).post('/api/chat').send({ message: 'Hello' });
  assert.equal(res.body.reply, notSure(CHILDRENS_HOSPITAL));
});

test("the physio clinic still gives its own emergency answer after the hospital app was built", async () => {
  hospitalApp();
  const res = await newVisitor(createApp({ ai: fakeAi() })).post('/api/chat').send({ message: 'I have chest pain' });
  assert.equal(res.body.reply, EMERGENCY_REPLY);
});

test("the hospital's booking form needs a phone number; an email is optional but must be real if given", async () => {
  const app = hospitalApp({ ai: null });
  const booking = { name: 'Parent Sample', service: 'Vaccination visit', timing: 'This week' };

  const noPhone = await newVisitor(app).post('/api/leads').send({ ...booking, email: 'parent@example.com' });
  assert.equal(noPhone.status, 400);
  assert.deepEqual(noPhone.body.fields, { phone: 'Please enter your phone number.' });

  const shortPhone = await newVisitor(app).post('/api/leads').send({ ...booking, phone: '0300' });
  assert.equal(shortPhone.status, 400);
  assert.equal(shortPhone.body.fields.phone, 'Please enter your phone number.');

  const badEmail = await newVisitor(app).post('/api/leads').send({ ...booking, phone: '0300 0000000', email: 'not-an-email' });
  assert.equal(badEmail.status, 400);
  assert.equal(badEmail.body.fields.email, 'Please enter a valid email address.');

  const ok = await newVisitor(app).post('/api/leads').send({ ...booking, phone: '0300 0000000' });
  assert.equal(ok.status, 201);
  const lead = await Lead.findOne({ name: 'Parent Sample' }).lean();
  assert.equal(lead.phone, '0300 0000000');
  assert.equal(lead.email, '');
  assert.equal(lead.service, 'Vaccination visit');

  // A physio service isn't a choice on the hospital's form.
  const wrongService = await newVisitor(app).post('/api/leads').send({ ...booking, phone: '0300 0000000', service: 'Sports massage' });
  assert.equal(wrongService.body.fields.service, 'Please choose a service.');
});

test("facts saved while showing the hospital never appear on the physio clinic's page, and the other way round", async () => {
  await Knowledge.deleteMany({});
  const owner = await testOwner();
  const hospital = createApp({ ai: fakeAi(), owner, profile: CHILDRENS_HOSPITAL });
  const session = await signIn(hospital);
  const saved = await session.owner.put('/api/owner/knowledge').send({
    services: [{ name: 'Eye check-up', minutes: 20, price: 900 }],
    hours: ['Open every day'],
    facts: ['Parking is free.'],
    greeting: 'Welcome to the edited hospital page.',
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.currency, 'Rs');
  assert.deepEqual((await Knowledge.find().lean()).map((doc) => doc._id), ['clinic:childrens-hospital']);
  assert.equal((await newVisitor(hospital).get('/api/clinic')).body.services[0].name, 'Eye check-up');

  const clinic = createApp({ ai: fakeAi(), owner });
  const page = (await newVisitor(clinic).get('/api/clinic')).body;
  assert.equal(page.name, 'Maple Lane Physio (Demo)');
  assert.equal(page.services.length, 4);
  assert.equal(page.services[0].name, 'First assessment');

  // Back on the hospital, the edit is still there; "reset" removes only the hospital's.
  const again = createApp({ ai: fakeAi(), owner, profile: CHILDRENS_HOSPITAL });
  assert.equal((await newVisitor(again).get('/api/clinic')).body.services[0].name, 'Eye check-up');
  await Knowledge.deleteMany({});
});

test('a private profile file gives the page a real name, and the page and the AI both say it is a demo', async () => {
  // Saved by Notepad: an invisible mark at the start of the file must not break it.
  const file = profileFile('private.json', `﻿${JSON.stringify(PRIVATE)}`);
  const profile = loadProfile({ CLINIC_PROFILE_FILE: file, CLINIC_PROFILE: 'maple-lane' }); // the file wins
  assert.equal(profile.name, 'Sample City Hospital');
  assert.equal(profile.id, 'file-sample-city-hospital');
  assert.equal(profile.knowledgeId, 'clinic:file-sample-city-hospital');
  assert.equal(profile.demoNote, 'Demo prepared for Sample City Hospital. Fees and timings are samples. Not a live service.');
  // The words and rules come from the children's hospital profile unless the file says otherwise.
  assert.equal(profile.contact, 'phone');
  assert.equal(profile.currency.symbol, 'Rs ');
  assert.equal(profile.emergencyReply, CHILDRENS_HOSPITAL.emergencyReply);
  assert.deepEqual(profile.tryAsking, CHILDRENS_HOSPITAL.tryAsking);

  const ai = fakeAi('Open 24 hours.');
  const app = createApp({ ai, profile });
  const page = (await newVisitor(app).get('/api/clinic')).body;
  assert.equal(page.name, 'Sample City Hospital');
  assert.match(page.demoNote, /^Demo prepared for Sample City Hospital/);
  assert.match(page.footerNote, /samples/);
  await newVisitor(app).post('/api/chat').send({ message: 'Are you open at night?' });
  assert.match(ai.calls[0].system, /This is a demo prepared for the hospital\. Some facts are samples/);
  assert.doesNotMatch(ai.calls[0].system, /Nanhay Qadam|made up for a demo/);
});

test('a broken private profile file stops the app with a message that names the problem', () => {
  assert.throws(() => profileFromFile(path.join(tmp, 'missing.json')), /the file can't be read/);
  assert.throws(() => profileFromFile(profileFile('broken.json', '{"name": ')), /isn't valid JSON/);
  const { name, ...noName } = PRIVATE;
  assert.throws(() => profileFromFile(profileFile('no-name.json', noName)), /CLINIC_PROFILE_FILE \(.*no-name\.json\): name: /);
  // A mistyped or unknown setting is refused, not silently ignored.
  assert.throws(() => profileFromFile(profileFile('extra.json', { ...PRIVATE, emergencyReply: 'Call us' })), /emergencyReply|Unrecognized/);
  assert.throws(() => profileFromFile(profileFile('base.json', { ...PRIVATE, base: 'dental' })), /base: /);
  assert.throws(
    () => profileFromFile(profileFile('price.json', { ...PRIVATE, services: [{ name: 'Check-up', minutes: 15, price: 'free' }] })),
    /services\.0\.price: /,
  );
  assert.equal(name, 'Sample City Hospital');
});
