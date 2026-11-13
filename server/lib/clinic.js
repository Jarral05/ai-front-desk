// The made-up clinic's facts. Pure data: no database, no network.
import { initials } from './brand.js';
import { CLINIC_SAMPLES } from './samples.js';
// The owner can edit the services, hours, facts and welcome (lib/knowledge.js); this stays the
// "reset to demo facts" copy. The name, tagline and "Try asking" questions aren't editable.

// Always added after the owner's welcome, so an edit can never remove the AI and demo notice.
// Two versions, because Google's free and paid tiers treat messages differently (Gemini API terms,
// read 13 Nov 2026): on the free tier Google may use them to improve its products; on the paid tier
// it doesn't. GEMINI_TIER in the settings says which one this copy uses (config.js).
export const AI_NOTICE = "I'm an AI assistant, not a person. This is a demo, so please use made-up "
  + "details. Messages are sent to Google's Gemini AI, and Google may use them to improve its "
  + 'products.';
export const AI_NOTICE_PAID = "I'm an AI assistant, not a person. This is a demo, so please use made-up "
  + "details. Messages are sent to Google's Gemini AI to write the answers.";
export const aiNotice = (tier = 'free') => (tier === 'paid' ? AI_NOTICE_PAID : AI_NOTICE);

export const DEMO_CLINIC = Object.freeze({
  // The profile parts (lib/profiles.js): the words and settings that differ from one kind of
  // business to another. The owner can't edit these.
  id: 'maple-lane',
  knowledgeId: 'clinic',
  kind: 'physiotherapy clinic',
  place: 'clinic',
  about: 'The clinic is made up for a demo.',
  currency: Object.freeze({ symbol: '$', name: 'US dollars' }),
  servicesTitle: 'Services',
  // Which contact detail the booking form insists on: 'email' or 'phone'.
  contact: 'email',
  demoNote: "Demo website for a made-up clinic. Please don't enter real personal details.",
  footerNote: 'A demo app. The clinic, its people and its prices are invented.',
  adviceInstead: 'suggest booking a first assessment',
  emergencyRule: 'tell them to contact emergency services now',
  emergencyReply: null, // null means the standard reply in lib/safety.js
  emergencyPatterns: Object.freeze([]),
  languageRule: null,
  // The page's colours (lib/brand.js checks they can be read) and an optional logo file.
  brand: Object.freeze({ dark: '#0f1e33', accent: '#0f766e', light: '#5eead4' }),
  logo: null,
  sampleLeads: CLINIC_SAMPLES,
  notSureText: null, // null means the standard English sentence in lib/prompts.js
  // Questions that get a fixed refusal without the AI (a hospital's medicine questions).
  advicePatterns: Object.freeze([]),
  adviceReply: null,

  name: 'Maple Lane Physio (Demo)',
  tagline: 'Physiotherapy for adults and teenagers in Sampletown.',
  services: Object.freeze([
    Object.freeze({ name: 'First assessment', minutes: 60, price: 80 }),
    Object.freeze({ name: 'Follow-up treatment', minutes: 40, price: 55 }),
    Object.freeze({ name: 'Sports massage', minutes: 45, price: 50 }),
    Object.freeze({ name: 'Online video consultation', minutes: 30, price: 40 }),
  ]),
  hours: Object.freeze([
    'Monday to Friday: 8am to 7pm',
    'Saturday: 9am to 1pm',
    'Sunday: closed',
  ]),
  facts: Object.freeze([
    'Patients: adults and teenagers aged 14 and over.',
    'Address: 12 Maple Lane, Sampletown. Free parking behind the clinic.',
    "No doctor's referral needed. Wear loose clothing.",
    "Cancellation: 24 hours' notice, or the full fee is charged.",
    "Insurance: we give an invoice to claim from your insurer; we don't bill insurers directly.",
  ]),
  // The owner's part of the chat's first message. AI_NOTICE always follows it.
  greeting: 'Hi, welcome to Maple Lane Physio (Demo). I can answer questions about our services, '
    + 'prices and opening hours, and help you book.',
  tryAsking: Object.freeze([
    'How much is a first assessment?',
    'Are you open on Saturday?',
    "Do I need a doctor's referral?",
  ]),
});

// What the public page needs. A copy, so a caller can't change the demo facts.
export function publicClinic(clinic = DEMO_CLINIC, tier = 'free') {
  return {
    name: clinic.name,
    tagline: clinic.tagline,
    services: clinic.services.map((service) => ({ ...service })),
    hours: [...clinic.hours],
    facts: [...clinic.facts],
    greeting: `${clinic.greeting} ${aiNotice(tier)}`,
    tryAsking: [...clinic.tryAsking],
    place: clinic.place,
    currency: clinic.currency.symbol,
    servicesTitle: clinic.servicesTitle,
    contact: clinic.contact,
    demoNote: clinic.demoNote,
    footerNote: clinic.footerNote,
    brand: { ...clinic.brand },
    initials: initials(clinic.name),
    // Only whether there is a logo: the picture itself comes from GET /api/logo.
    logo: Boolean(clinic.logo),
  };
}

// The services a booking may name, plus "Not sure".
export function serviceChoices(clinic = DEMO_CLINIC) {
  return [...clinic.services.map((service) => service.name), 'Not sure'];
}

// The facts as plain lines for the AI. The PDF's text is sent separately (lib/prompts.js).
export function clinicFactsText(clinic = DEMO_CLINIC) {
  const { symbol, name: currencyName } = clinic.currency;
  const place = clinic.place[0].toUpperCase() + clinic.place.slice(1);
  return [
    `${place} name: ${clinic.name}`,
    clinic.tagline,
    `Services and prices (${currencyName}):`,
    ...clinic.services.map((s) => `- ${s.name}: ${s.minutes} minutes, ${symbol}${s.price}`),
    'Opening hours:',
    ...clinic.hours.map((line) => `- ${line}`),
    ...clinic.facts,
  ].join('\n');
}
