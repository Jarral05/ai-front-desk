// Everything the bot knows: the owner's edited facts and PDF text, or the demo facts.
// Read fresh from the database for every chat message, so an edit counts from the next message,
// and two copies of the app on two servers always agree.
import { LIMITS } from '../config.js';
import { HttpError } from '../errors.js';
import { Knowledge } from '../models.js';
import { clinicFactsText } from './clinic.js';
import { activeProfile } from './profiles.js';

// Each profile keeps its own saved facts, so an edit made while showing one business can never
// appear under another's name.
const id = () => activeProfile().knowledgeId;

// The full clinic: the profile's fixed parts (name, tagline, "Try asking") plus the owner's edits.
export async function getClinic() {
  const saved = await Knowledge.findById(id()).lean();
  return {
    ...activeProfile(),
    ...(saved ? { services: saved.services, hours: saved.hours, facts: saved.facts, greeting: saved.greeting } : {}),
    pdf: saved?.pdf ?? null,
    custom: Boolean(saved),
  };
}

// The number SPEC.md caps at 20,000: the facts as the AI reads them, plus the PDF's text.
export function knownChars(clinic, pdfText = clinic.pdf?.text ?? '') {
  return clinicFactsText(clinic).length + pdfText.length;
}

function checkCap(chars) {
  if (chars > LIMITS.knowledgeChars) {
    throw new HttpError(400, `The assistant can know up to ${LIMITS.knowledgeChars.toLocaleString('en-US')} `
      + `characters, and this would be ${chars.toLocaleString('en-US')}. Shorten the facts or the PDF.`);
  }
}

const facts = ({ services, hours, facts: lines, greeting }) => ({ services, hours, facts: lines, greeting });

export async function saveFacts(input) {
  const current = await getClinic();
  checkCap(knownChars({ ...current, ...input }));
  await Knowledge.updateOne({ _id: id() }, { $set: facts(input) }, { upsert: true });
}

// The first PDF on the demo facts also saves the demo facts, so the document is complete.
export async function savePdf(pdf) {
  const current = await getClinic();
  checkCap(knownChars(current, pdf.text));
  await Knowledge.updateOne(
    { _id: id() },
    { $set: { ...facts(current), pdf: { ...pdf, uploadedAt: new Date() } } },
    { upsert: true },
  );
}

export async function removePdf() {
  await Knowledge.updateOne({ _id: id() }, { $set: { pdf: null } });
}

export async function resetToDemo() {
  await Knowledge.deleteOne({ _id: id() });
}
