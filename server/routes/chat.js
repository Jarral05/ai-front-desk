// POST /api/chat: one visitor message in, one assistant reply out.
import { randomUUID } from 'node:crypto';
import express from 'express';
import { z } from 'zod';
import { LIMITS } from '../config.js';
import { Conversation } from '../models.js';
import { AiError } from '../lib/ai.js';
import { clinicFactsText } from '../lib/clinic.js';
import { allowVisitorMessage, countStat, reserveAiCall, visitorId } from '../lib/counters.js';
import { getClinic } from '../lib/knowledge.js';
import { chatRules, NOT_SURE } from '../lib/prompts.js';
import { EMERGENCY_REPLY, looksLikeEmergency } from '../lib/safety.js';
import { HttpError } from '../errors.js';

const ChatInput = z.object({
  conversationId: z.uuid().optional(),
  message: z.string().trim().min(1, 'Please type a message.')
    .max(LIMITS.messageChars, `Please keep messages under ${LIMITS.messageChars} characters.`),
});

// Turns zod's complaint into one short sentence for the visitor.
export function firstProblem(result) {
  return result.error.issues[0]?.message ?? 'Invalid request';
}

async function findOrStart(conversationId, visitor) {
  const found = conversationId ? await Conversation.findById(conversationId) : null;
  // An unknown or expired ID simply starts a fresh chat; it never reaches someone else's.
  return found ?? new Conversation({ _id: randomUUID(), visitor });
}

// What the visitor sees. The reply is cut to a sensible length; the page shows it as plain text.
function cleanReply(text) {
  const reply = String(text ?? '').trim().slice(0, 1200);
  return reply || NOT_SURE;
}

export function chatRoutes({ ai }) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    const parsed = ChatInput.safeParse(req.body ?? {});
    if (!parsed.success) throw new HttpError(400, firstProblem(parsed));
    const { message } = parsed.data;
    const visitor = visitorId(req.ip);

    const conversation = await findOrStart(parsed.data.conversationId, visitor);
    const isNewChat = conversation.isNew;
    const save = async (reply) => {
      conversation.messages.push({ role: 'visitor', text: message }, { role: 'assistant', text: reply });
      conversation.visitorMessages += 1;
      await conversation.save();
      if (isNewChat) await countStat('chats');
      res.json({
        conversationId: conversation._id,
        reply,
        remaining: LIMITS.messagesPerConversation - conversation.visitorMessages,
      });
    };

    // Emergencies first: a fixed answer that needs no AI and is never refused by a limit.
    if (looksLikeEmergency(message)) return save(EMERGENCY_REPLY);

    if (conversation.visitorMessages >= LIMITS.messagesPerConversation) {
      throw new HttpError(429, 'This chat has reached its limit of 20 messages. You can still book with the form, or start a new chat.');
    }
    if (!(await allowVisitorMessage(visitor))) {
      throw new HttpError(429, "You've sent a lot of messages this hour. Please try again later, or use the booking form.");
    }
    if (!ai) throw new HttpError(503, "The assistant isn't switched on yet. Please use the booking form.");

    const slot = await reserveAiCall();
    if (slot === 'day') throw new HttpError(503, "The demo assistant has answered all it can for today. Please try again tomorrow, or use the booking form.");
    if (slot === 'minute') throw new HttpError(503, 'The assistant is busy. Please try again in a minute.');

    // Read now, not at startup: an edit on the Knowledge page counts from the very next message.
    const clinic = await getClinic();
    try {
      const text = await ai.generate({
        system: chatRules(clinicFactsText(clinic), clinic.pdf?.text ?? ''),
        messages: [...conversation.messages.slice(-2 * LIMITS.messagesPerConversation), { role: 'visitor', text: message }],
      });
      return save(cleanReply(text));
    } catch (error) {
      if (error instanceof AiError && error.kind === 'busy') {
        throw new HttpError(503, 'The assistant is busy. Please try again in a minute.');
      }
      throw new HttpError(503, "The assistant couldn't answer just now. Please try again, or use the booking form.");
    }
  });

  return router;
}
