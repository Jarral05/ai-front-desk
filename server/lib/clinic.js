// The made-up clinic's facts. Pure data: no database, no network.
// From Part 5 the owner can edit these; this stays the "reset to demo facts" copy.

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
});

// What the public page needs. A copy, so a caller can't change the demo facts.
export function publicClinic(clinic = DEMO_CLINIC) {
  return {
    name: clinic.name,
    tagline: clinic.tagline,
    services: clinic.services.map((service) => ({ ...service })),
    hours: [...clinic.hours],
    facts: [...clinic.facts],
  };
}
