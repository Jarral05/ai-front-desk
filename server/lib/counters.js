// Counting for the limits. One atomic database update per check, so two requests arriving at
// the same moment can't both slip under a limit.
import { createHash } from 'node:crypto';
import { Counter } from '../models.js';
import { LIMITS } from '../config.js';

// The visitor's IP is turned into a short fingerprint. The limits only need to tell visitors
// apart; storing the address itself isn't necessary.
export function visitorId(ip = '') {
  return createHash('sha256').update(`ai-front-desk:${ip}`).digest('hex').slice(0, 24);
}

// Adds one to a counter and returns the new count. The counter deletes itself after `seconds`.
export async function bump(key, seconds) {
  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + seconds * 1000) } },
    { upsert: true, returnDocument: 'after' },
  );
  return doc.count;
}

export async function readCount(key) {
  const doc = await Counter.findById(key).lean();
  return doc?.count ?? 0;
}

// Windows by the clock (UTC): "2026-11-10" for a day, "2026-11-10T14" for an hour, and so on.
export const windows = {
  day: (now = new Date()) => now.toISOString().slice(0, 10),
  hour: (now = new Date()) => now.toISOString().slice(0, 13),
  minute: (now = new Date()) => now.toISOString().slice(0, 16),
};

// True if this visitor may send another chat message this hour.
export async function allowVisitorMessage(visitor) {
  const count = await bump(`chat-hour:${visitor}:${windows.hour()}`, 2 * 60 * 60);
  return count <= LIMITS.messagesPerVisitorHour;
}

export async function allowVisitorLead(visitor) {
  const count = await bump(`lead-hour:${visitor}:${windows.hour()}`, 2 * 60 * 60);
  return count <= LIMITS.leadsPerVisitorHour;
}

// Numbers for the owner's dashboard: one counter per kind ('chats', 'leads', 'hot') per day, kept
// for 8 days. Leads delete themselves after 24 hours, so "the last 7 days" can't be counted from
// leads; these counters hold no personal details, so they can safely last longer.
export async function countStat(kind) {
  try {
    await bump(`stat-${kind}:${windows.day()}`, 8 * 24 * 60 * 60);
  } catch (error) {
    // A missed count must never cost a visitor their chat or lead.
    console.error('Could not count a stat:', kind, error?.name ?? 'Error');
  }
}

export async function statLastDays(kind, days, now = new Date()) {
  const keys = Array.from({ length: days }, (_, i) => `stat-${kind}:${windows.day(new Date(now - i * 86400000))}`);
  const found = await Counter.find({ _id: { $in: keys } }).lean();
  return found.reduce((sum, doc) => sum + doc.count, 0);
}

// Reserves one AI call for the whole app. Returns 'ok', 'minute' or 'day'.
// The day is checked first: once it's used up, the minute counter isn't touched.
export async function reserveAiCall() {
  const dayKey = `ai-day:${windows.day()}`;
  if ((await readCount(dayKey)) >= LIMITS.aiCallsPerDay) return 'day';
  const minute = await bump(`ai-minute:${windows.minute()}`, 2 * 60);
  if (minute > LIMITS.aiCallsPerMinute) return 'minute';
  const day = await bump(dayKey, 2 * 24 * 60 * 60);
  // Logged once a day, when the last allowed call is taken (OWASP A09): the owner should know the
  // chat has stopped answering until tomorrow.
  if (day === LIMITS.aiCallsPerDay) console.warn(`AI daily limit reached: ${LIMITS.aiCallsPerDay} calls today. The chat answers again tomorrow.`);
  return day > LIMITS.aiCallsPerDay ? 'day' : 'ok';
}
