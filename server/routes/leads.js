// POST /api/leads: the booking form inside the chat.
// Order matters: the lead is saved first, then the AI is asked for a summary. If the AI is slow,
// down or over its limit, the lead is already safe and simply stays "Unscored".
import express from 'express';
import { z } from 'zod';
import { Conversation, Lead, TIMINGS } from '../models.js';
import { allowVisitorLead, countStat, reserveAiCall, visitorId } from '../lib/counters.js';
import { serviceChoices } from '../lib/clinic.js';
import { getClinic } from '../lib/knowledge.js';
import { leadData, LEAD_JSON_SCHEMA, leadRules } from '../lib/prompts.js';
import { scoreLead } from '../lib/score.js';
import { HttpError } from '../errors.js';

// Built for each request, because the services a visitor may choose are the owner's current ones.
const leadInput = (services) => z.object({
  name: z.string().trim().min(2, 'Please enter your name.').max(80, 'Please keep your name under 80 characters.'),
  email: z.email('Please enter a valid email address.').max(120, 'That email address is too long.'),
  phone: z.string().trim().max(30, 'That phone number is too long.')
    .regex(/^[0-9+()\-\s]*$/, 'A phone number can only use digits, spaces and + ( ) -.')
    .optional().default(''),
  service: z.string().refine((value) => services.includes(value), 'Please choose a service.'),
  timing: z.enum(TIMINGS, 'Please choose when you would like to come.'),
  message: z.string().trim().max(500, 'Please keep your message under 500 characters.').optional().default(''),
  conversationId: z.uuid().optional(),
  // A hidden field people never see. Bots that fill in every box fill this one too.
  website: z.string().max(200).optional().default(''),
});

// The AI's answer, checked again here: following the JSON schema is likely, not guaranteed.
const AiSummary = z.object({
  summary: z.string().trim().min(10).max(600),
  intent: z.enum(['ready_to_book', 'comparing_options', 'question_only']),
});

// "Exactly two sentences" is asked for; more than two is cut to two, never trusted blindly.
export function twoSentences(text) {
  const sentences = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [text];
  return sentences.slice(0, 2).join('').trim().slice(0, 400);
}

export async function summarise(ai, lead, messages) {
  if (!ai) return null;
  if ((await reserveAiCall()) !== 'ok') return null;
  try {
    const raw = await ai.generate({
      system: leadRules(),
      messages: [{ role: 'visitor', text: leadData(lead, messages) }],
      json: LEAD_JSON_SCHEMA,
      maxOutputTokens: 300,
    });
    const checked = AiSummary.safeParse(JSON.parse(raw));
    if (!checked.success) return null;
    return { summary: twoSentences(checked.data.summary), intent: checked.data.intent };
  } catch {
    // Timeouts, Google errors and broken JSON all end the same way: the lead stays Unscored.
    return null;
  }
}

export function leadRoutes({ ai }) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    const parsed = leadInput(serviceChoices(await getClinic())).safeParse(req.body ?? {});
    if (!parsed.success) {
      const fields = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? 'form');
        fields[field] ??= issue.message;
      }
      throw new HttpError(400, 'Please check the form.', fields);
    }
    const input = parsed.data;
    const visitor = visitorId(req.ip);

    // A bot filled the hidden field: say thank you, keep nothing.
    if (input.website) return res.status(201).json({ ok: true });

    if (!(await allowVisitorLead(visitor))) {
      throw new HttpError(429, "You've sent several bookings this hour. Please try again later.");
    }

    // The chat is only used if it belongs to this visitor.
    const conversation = input.conversationId
      ? await Conversation.findOne({ _id: input.conversationId, visitor }).lean()
      : null;

    const lead = await Lead.create({
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      service: input.service,
      timing: input.timing,
      message: input.message,
      conversationId: conversation?._id ?? null,
      visitor,
    });
    await countStat('leads');

    const result = await summarise(ai, lead, conversation?.messages ?? []);
    if (result) {
      const { score, reasons } = scoreLead({ timing: lead.timing, service: lead.service, intent: result.intent });
      await Lead.updateOne(
        { _id: lead._id },
        { summary: result.summary, intent: result.intent, score, scoreReasons: reasons },
      );
      if (score === 'Hot') await countStat('hot');
    }

    // The visitor gets a thank-you, not their score: that's for the owner.
    res.status(201).json({ ok: true });
  });

  return router;
}
