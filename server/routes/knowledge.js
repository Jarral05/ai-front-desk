// /api/owner/knowledge: what the bot knows (Part 5). Only reachable after the owner's sign-in
// check in routes/owner.js.
import path from 'node:path';
import express from 'express';
import { z } from 'zod';
import { LIMITS } from '../config.js';
import { HttpError } from '../errors.js';
import { aiNotice } from '../lib/clinic.js';
import { bump, windows } from '../lib/counters.js';
import { getClinic, knownChars, removePdf, resetToDemo, saveFacts, savePdf } from '../lib/knowledge.js';
import { readPdfText } from '../lib/pdf.js';

const line = (max) => z.string().trim().min(1, "A line can't be empty.").max(max, `A line can be up to ${max} characters.`);

const Service = z.object({
  name: z.string().trim()
    .min(2, 'Give the service a name.')
    .max(60, 'A service name can be up to 60 characters.')
    .refine((name) => name.toLowerCase() !== 'not sure', '"Not sure" is already a choice on the booking form.'),
  minutes: z.number('Enter the minutes as a number.').int('Use whole minutes.')
    .min(5, 'At least 5 minutes.').max(480, 'At most 480 minutes.'),
  price: z.number('Enter the price as a number.').int('Use a whole number, for example 55.')
    .min(0, "The price can't be below 0.").max(100000, 'That price is too high.'),
});

const KnowledgeInput = z.object({
  services: z.array(Service).min(1, 'Add at least one service.').max(12, 'Up to 12 services.')
    .refine((list) => new Set(list.map((s) => s.name.toLowerCase())).size === list.length, 'Two services have the same name.'),
  hours: z.array(line(100)).min(1, 'Add at least one line of opening hours.').max(10, 'Up to 10 lines of opening hours.'),
  facts: z.array(line(300)).max(20, 'Up to 20 facts.'),
  greeting: z.string().trim()
    .min(10, 'The welcome needs at least 10 characters.')
    .max(400, 'The welcome can be up to 400 characters.'),
});

// zod names the problem by its path, for example ['services', 2, 'price']. The page shows each
// message next to the box it belongs to.
function fieldsFrom(issues) {
  const fields = {};
  for (const { path: where, message } of issues) {
    const [top, index, key] = where;
    let field = String(top ?? 'form');
    let text = message;
    if (top === 'services' && typeof index === 'number' && key) field = `services.${index}.${key}`;
    else if ((top === 'hours' || top === 'facts') && typeof index === 'number') text = `Line ${index + 1}: ${message}`;
    fields[field] ??= text;
  }
  return fields;
}

// What the Knowledge page shows, including the PDF's text exactly as the assistant reads it.
async function view(tier) {
  const clinic = await getClinic();
  return {
    services: clinic.services.map(({ name, minutes, price }) => ({ name, minutes, price })),
    hours: [...clinic.hours],
    facts: [...clinic.facts],
    greeting: clinic.greeting,
    notice: aiNotice(tier),
    currency: clinic.currency.symbol.trim(),
    pdf: clinic.pdf
      ? { name: clinic.pdf.name, pages: clinic.pdf.pages, chars: clinic.pdf.text.length, uploadedAt: clinic.pdf.uploadedAt, text: clinic.pdf.text }
      : null,
    usedChars: knownChars(clinic),
    maxChars: LIMITS.knowledgeChars,
    isDemo: !clinic.custom,
  };
}

// Keeps letters, digits and a few safe marks, drops any folder part, and keeps the end of a long
// name so the extension survives. The same rules as the portal's uploads.
export function cleanFileName(raw) {
  let name = '';
  try {
    name = decodeURIComponent(raw ?? '');
  } catch {
    name = '';
  }
  name = path.posix.basename(name.replaceAll('\\', '/'));
  name = name.replace(/[^\w.() -]/g, '_').replace(/^[.\s]+/, '').slice(-100).trim();
  return name || 'document.pdf';
}

// Reads the raw file, up to 2 MB. A bigger one is refused from its size header, before it's read.
const rawPdf = express.raw({ type: () => true, limit: LIMITS.pdfBytes });
function pdfBody(req, res, next) {
  rawPdf(req, res, (error) => {
    if (error?.type === 'entity.too.large') return next(new HttpError(413, 'The PDF can be up to 2 MB.'));
    next(error);
  });
}

async function uploadLimit(_req, _res, next) {
  if ((await bump(`owner-pdf:${windows.hour()}`, 2 * 60 * 60)) > LIMITS.pdfUploadsPerHour) {
    throw new HttpError(429, 'That is a lot of uploads this hour. Please try again later.');
  }
  next();
}

export function knowledgeRoutes({ tier = 'free' } = {}) {
  const router = express.Router();

  router.get('/', async (_req, res) => res.json(await view(tier)));

  router.put('/', async (req, res) => {
    const parsed = KnowledgeInput.safeParse(req.body ?? {});
    if (!parsed.success) throw new HttpError(400, 'Please check the highlighted boxes.', fieldsFrom(parsed.error.issues));
    await saveFacts(parsed.data);
    res.json(await view(tier));
  });

  router.post('/pdf', uploadLimit, pdfBody, async (req, res) => {
    const { pages, text } = await readPdfText(req.body);
    const name = cleanFileName(req.get('x-file-name'));
    if (path.extname(name).toLowerCase() !== '.pdf') {
      throw new HttpError(415, 'Only PDF files can be uploaded, and the file must really be one.');
    }
    if (text.length < 10) {
      throw new HttpError(400, 'This PDF has no text the assistant can read. It may be a scanned picture of a page: '
        + 'try a PDF saved from a document instead.');
    }
    await savePdf({ name, pages, text });
    res.status(201).json(await view(tier));
  });

  router.delete('/pdf', async (_req, res) => {
    await removePdf();
    res.json(await view(tier));
  });

  router.post('/reset', async (_req, res) => {
    await resetToDemo();
    res.json(await view(tier));
  });

  return router;
}
