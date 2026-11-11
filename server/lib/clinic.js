// The made-up clinic's facts. Pure data: no database, no network.
// The owner can edit the services, hours, facts and welcome (lib/knowledge.js); this stays the
// "reset to demo facts" copy. The name, tagline and "Try asking" questions aren't editable.

// Always added after the owner's welcome, so an edit can never remove the AI and demo notice.
export const AI_NOTICE = "I'm an AI assistant, not a person. This is a demo, so please use made-up "
  + "details. Messages are sent to Google's Gemini AI, and Google may use them to improve its "
  + 'products.';

export const DEMO_CLINIC = Object.freeze({
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
export function publicClinic(clinic = DEMO_CLINIC) {
  return {
    name: clinic.name,
    tagline: clinic.tagline,
    services: clinic.services.map((service) => ({ ...service })),
    hours: [...clinic.hours],
    facts: [...clinic.facts],
    greeting: `${clinic.greeting} ${AI_NOTICE}`,
    tryAsking: [...clinic.tryAsking],
  };
}

// The services a booking may name, plus "Not sure".
export function serviceChoices(clinic = DEMO_CLINIC) {
  return [...clinic.services.map((service) => service.name), 'Not sure'];
}

// The facts as plain lines for the AI. The PDF's text is sent separately (lib/prompts.js).
export function clinicFactsText(clinic = DEMO_CLINIC) {
  return [
    `Clinic name: ${clinic.name}`,
    clinic.tagline,
    'Services and prices (US dollars):',
    ...clinic.services.map((s) => `- ${s.name}: ${s.minutes} minutes, $${s.price}`),
    'Opening hours:',
    ...clinic.hours.map((line) => `- ${line}`),
    ...clinic.facts,
  ].join('\n');
}
