// Shared test helpers: a throwaway database, a fake AI and visitors with their own IPs.
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { connectDatabase } from '../server/db.js';
import { Counter } from '../server/models.js';

let memory;

// The app allows 12 AI calls a minute. Tests send far more than that within seconds, so they
// clear the minute counter between messages, as if a minute had passed. The limit itself is
// tested on its own.
export function nextMinute() {
  return Counter.deleteMany({ _id: /^ai-minute:/ });
}

// Sets a counter to an exact number, for example the day's AI calls to 300.
export function setCount(_id, count) {
  return Counter.updateOne(
    { _id },
    { $set: { count, expiresAt: new Date(Date.now() + 2 * 86400000) } },
    { upsert: true },
  );
}

export async function startDatabase() {
  memory = await MongoMemoryServer.create();
  await connectDatabase(memory.getUri('test'));
  // Builds the indexes (including the 24-hour TTL ones) before any test runs.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

export async function stopDatabase() {
  await mongoose.disconnect();
  await memory.stop();
}

// A stand-in for Gemini. It records every call and answers with `reply`, which can be a
// string, a function of the call, or an Error to throw.
export function fakeAi(reply = 'We are open on Saturday from 9am to 1pm.') {
  const ai = {
    calls: [],
    reply,
    async generate(args) {
      ai.calls.push(args);
      const answer = typeof ai.reply === 'function' ? ai.reply(args) : ai.reply;
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
  return ai;
}

// Each visitor gets their own IP (the app trusts one proxy), so limits don't leak between tests.
let visitorNumber = 0;
export function newVisitor(app) {
  visitorNumber += 1;
  const ip = `203.0.113.${visitorNumber}`;
  return {
    ip,
    post: (url) => request(app).post(url).set('X-Forwarded-For', ip),
  };
}
