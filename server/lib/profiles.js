// Profiles: one app, several kinds of business. A profile holds the words and settings that
// differ (clinic or hospital, dollars or rupees, email or phone) plus its starting facts.
// One copy of the app shows one profile, chosen when it starts:
//   CLINIC_PROFILE=childrens-hospital       a built-in, made-up profile from this file
//   CLINIC_PROFILE_FILE=../some/file.json   a private profile kept outside this repository
// With neither, the app is Maple Lane Physio, exactly as before.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { brandProblem, HEX_COLOUR, LOGO_BYTES, logoType } from './brand.js';
import { DEMO_CLINIC } from './clinic.js';
import { HOSPITAL_SAMPLES } from './samples.js';

// A made-up children's hospital in Mirpur. Every name, number, fee and address is invented.
export const CHILDRENS_HOSPITAL = Object.freeze({
  ...DEMO_CLINIC,
  id: 'childrens-hospital',
  knowledgeId: 'clinic:childrens-hospital',
  kind: "children's hospital",
  place: 'hospital',
  about: 'The hospital is made up for a demo.',
  currency: Object.freeze({ symbol: 'Rs ', name: 'Pakistani rupees' }),
  servicesTitle: 'Check-ups and fees',
  contact: 'phone',
  brand: Object.freeze({ dark: '#173a5e', accent: '#c2410c', light: '#fde68a' }),
  sampleLeads: HOSPITAL_SAMPLES,
  demoNote: "Demo website for a made-up hospital. Please don't enter real personal details.",
  footerNote: 'A demo app. The hospital, its doctors and its fees are invented.',
  adviceInstead: 'suggest booking a check-up with a child specialist, or coming to the emergency '
    + 'room if it seems urgent',
  emergencyRule: 'tell them to go to the nearest hospital emergency room now or call an ambulance',
  emergencyReply: 'This sounds like it could be an emergency. Please take the child to the nearest '
    + 'hospital emergency room now, or call an ambulance. This chat is a demo and cannot help in '
    + 'an emergency.\n'
    + 'یہ ایمرجنسی ہو سکتی ہے۔ براہِ کرم بچے کو فوراً قریبی ہسپتال کی ایمرجنسی لے جائیں یا ایمبولینس بلائیں۔',
  // On top of the standard list in lib/safety.js: what a frightened parent types, in English,
  // Roman Urdu and Urdu.
  emergencyPatterns: Object.freeze([
    /seizure|convulsion|\b(having|has|had|got|getting) (a )?fits?\b/i,
    /(turn(ed|ing)?|going|gone|lips( are)?) blue|blue lips/i,
    /chok(ing|ed)/i,
    /swallowed|poison/i,
    /(not|isn'?t|won'?t|doesn'?t) (waking|wake|responding|respond)/i,
    /sa+ns (nahi|nai|nhi|ruk|band)/i,
    /be ?ho+sh/i,
    /jhatk|daur[ae]y? pa[rd]/i,
    /z[ae]h[ae]r/i,
    /khoo?n (bohat|bahut|ruk nahi|band nahi)/i,
    /سانس (نہیں|رک|بند)/,
    /بے ?ہوش/,
    /جھٹک|دورہ پڑ/,
    /زہر/,
  ]),
  languageRule: 'Reply in the language the visitor writes in: English, Urdu (in Urdu script) or '
    + 'Roman Urdu. This also applies when you refuse under rule 2. Use everyday Pakistani Urdu '
    + 'words (for example Hafta for Saturday), not Hindi ones. Keep names, fees and times exactly '
    + 'as they are in the facts.',
  // Fixed sentences carry both languages, so they never depend on the AI translating them.
  notSureText: "I'm not sure about that. You can ask the hospital directly with the booking form.\n"
    + 'مجھے اس بارے میں یقین نہیں۔ آپ بکنگ فارم کے ذریعے ہسپتال سے براہِ راست پوچھ سکتے ہیں۔',
  // "Which medicine, how much?" never reaches the AI: the answer is fixed and instant. The words
  // need a question shape around them, so "is the pharmacy open?" still goes to the AI.
  advicePatterns: Object.freeze([
    /(which|what|any) (medicine|medication|syrup|tablet|drug|antibiotic)/i,
    /(medicine|medication|syrup|tablet|antibiotic|panadol|paracetamol|brufen)s? (should|can|do) (i|we)\b/i,
    /(can|should|may) (i|we) give\b/i,
    /how (much|many) (medicine|syrup|panadol|paracetamol|brufen|drops|tablets?|ml)\b/i,
    /\b(dose|dosage|khura+k)\b/i,
    /(kaun ?si|kon ?si|konsi|kya|kitni) (dawa|dawai|dawae|dwai|medicine|syrup|tablet|goli)/i,
    /(dawa|dawai|dawae|dwai|medicine|syrup|tablet|goli|panadol|brufen) (doo+n|du+n|dein|dain|de ?sakt|dena|deni|pila)/i,
    /کون ?سی (دوا|دوائی|گولی)/,
    /(دوا|دوائی|شربت|گولی) (دوں|دیں|دے سکت|دینی|پلا)/,
    /خوراک/,
  ]),
  adviceReply: "I can't advise on medicines, doses or symptoms. A child specialist can: press "
    + '"Book an appointment" in this chat. If it seems urgent, please go to the emergency room now.\n'
    + 'میں دوا، خوراک یا علامات کے بارے میں مشورہ نہیں دے سکتی۔ بچوں کے ڈاکٹر سے چیک اپ کے لیے اسی چیٹ میں '
    + '"Book an appointment" دبائیں۔ اگر معاملہ فوری لگے تو براہِ کرم ابھی ایمرجنسی آئیں۔',

  name: "Nanhay Qadam Children's Hospital (Demo)",
  tagline: 'Care for newborns and children up to 14 years, in Mirpur, Azad Kashmir.',
  services: Object.freeze([
    Object.freeze({ name: 'Child specialist check-up', minutes: 15, price: 1500 }),
    Object.freeze({ name: 'Newborn baby check-up', minutes: 20, price: 2000 }),
    Object.freeze({ name: 'Vaccination visit', minutes: 10, price: 500 }),
    Object.freeze({ name: 'Growth and nutrition clinic', minutes: 20, price: 1200 }),
  ]),
  hours: Object.freeze([
    'Emergency and admissions: open 24 hours, every day',
    'Morning check-ups: Monday to Saturday, 9am to 1pm',
    'Evening check-ups: Monday to Saturday, 5pm to 9pm',
    'Sunday: emergency only',
  ]),
  facts: Object.freeze([
    'Patients: newborn babies and children up to 14 years.',
    'Address: Plot 00, Sample Road, Mirpur, Azad Kashmir (a made-up address).',
    'Phone: 05827 000000 (a made-up number).',
    'Child specialists (made-up names): Dr Ayesha Demo sees patients in the morning, Dr Bilal Demo in the evening.',
    "Bring the child's vaccination card and any earlier reports or prescriptions.",
    'The vaccination visit fee does not include the price of the vaccine.',
    'One parent can stay with an admitted child. Visiting time is 4pm to 6pm.',
    'The laboratory and the pharmacy are open 24 hours.',
    'Payment: cash or bank card at reception.',
  ]),
  greeting: "Assalam-o-Alaikum, welcome to Nanhay Qadam Children's Hospital (Demo). I can answer "
    + "questions about check-up fees, doctors' timings and visiting, in English or Urdu, and help "
    + 'you request an appointment.',
  tryAsking: Object.freeze([
    'Child specialist ki fee kitni hai?',
    'Is the emergency open at night?',
    'What should I bring for a vaccination visit?',
  ]),
});

export const PROFILES = Object.freeze({
  [DEMO_CLINIC.id]: DEMO_CLINIC,
  [CHILDRENS_HOSPITAL.id]: CHILDRENS_HOSPITAL,
});

// A private profile is a small JSON file: the starting facts for one real business, on top of a
// built-in profile's words and rules. The same limits as the owner's Knowledge page.
const line = (max) => z.string().trim().min(1).max(max);
const FileProfile = z.strictObject({
  base: z.enum(Object.keys(PROFILES)).default(CHILDRENS_HOSPITAL.id),
  name: z.string().trim().min(3).max(80),
  tagline: z.string().trim().min(3).max(160),
  services: z.array(z.strictObject({
    name: z.string().trim().min(2).max(60),
    minutes: z.number().int().min(5).max(480),
    price: z.number().int().min(0).max(100000),
  })).min(1).max(12),
  hours: z.array(line(100)).min(1).max(10),
  facts: z.array(line(300)).max(20),
  greeting: z.string().trim().min(10).max(400),
  tryAsking: z.array(line(80)).min(1).max(4).optional(),
  demoNote: z.string().trim().min(10).max(200).optional(),
  brand: z.strictObject({
    dark: z.string().regex(HEX_COLOUR, 'Use a colour like #173a5e.'),
    accent: z.string().regex(HEX_COLOUR, 'Use a colour like #c2410c.'),
    light: z.string().regex(HEX_COLOUR, 'Use a colour like #fde68a.'),
  }).optional(),
  // A file name next to the profile file, for example "logo.png".
  logo: z.string().trim().min(5).max(120).optional(),
});

// Reads the logo next to the profile file. Only PNG, JPEG or WebP by their first bytes, up to
// 300 KB, and never a file outside that folder.
function readLogo(folder, name, fail) {
  const where = path.resolve(folder, name);
  if (path.dirname(where) !== path.resolve(folder)) throw fail('logo: put the logo in the same folder as the profile file.');
  let bytes;
  try {
    bytes = fs.readFileSync(where);
  } catch {
    throw fail(`logo: "${name}" can't be read. Check the file name.`);
  }
  if (bytes.length > LOGO_BYTES) throw fail('logo: the file can be up to 300 KB.');
  const type = logoType(bytes);
  if (!type) throw fail("logo: use a PNG, JPEG or WebP picture. SVG isn't allowed, because it can carry scripts.");
  return Object.freeze({ type, bytes });
}

export function profileFromFile(file) {
  const where = path.resolve(file);
  const fail = (why) => new Error(`CLINIC_PROFILE_FILE (${where}): ${why}`);
  let raw;
  try {
    // Notepad on Windows may put an invisible mark at the start of a file; JSON can't read it.
    raw = fs.readFileSync(where, 'utf8').replace(/^﻿/, '');
  } catch {
    throw fail("the file can't be read. Check the path.");
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw fail("the file isn't valid JSON. Check for a missing comma or quote.");
  }
  const parsed = FileProfile.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw fail(`${issue.path.join('.') || 'file'}: ${issue.message}`);
  }
  const { base, logo, ...own } = parsed.data;
  if (own.brand) {
    const problem = brandProblem(own.brand);
    if (problem) throw fail(`brand: ${problem}`);
  }
  const slug = own.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'private';
  const basis = PROFILES[base];
  return Object.freeze({
    ...basis,
    ...own,
    tryAsking: own.tryAsking ?? basis.tryAsking,
    brand: Object.freeze({ ...(own.brand ?? basis.brand) }),
    logo: logo ? readLogo(path.dirname(where), logo, fail) : null,
    id: `file-${slug}`,
    knowledgeId: `clinic:file-${slug}`,
    // A real name is on the page, so the page and the AI both say what this is.
    about: `This is a demo prepared for the ${basis.place}. Some facts are samples and are marked as such.`,
    demoNote: own.demoNote
      ?? `Demo prepared for ${own.name}. Fees and timings are samples. Not a live service.`,
    footerNote: 'A demo app. Fees, timings and staff shown are samples.',
  });
}

export function loadProfile(env = process.env) {
  if (env.CLINIC_PROFILE_FILE) return profileFromFile(env.CLINIC_PROFILE_FILE);
  const id = env.CLINIC_PROFILE || DEMO_CLINIC.id;
  if (!Object.hasOwn(PROFILES, id)) {
    throw new Error(`CLINIC_PROFILE "${id}" isn't known. Choose one of: ${Object.keys(PROFILES).join(', ')}.`);
  }
  return PROFILES[id];
}

// The profile this copy of the app is showing. Set once when the app is built (server/app.js).
let active = null;
export function activeProfile() {
  active ??= loadProfile();
  return active;
}
export function useProfile(profile) {
  active = profile;
}
