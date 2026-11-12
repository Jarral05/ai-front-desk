// Shared test helpers: a throwaway database, a fake AI and visitors with their own IPs.
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { connectDatabase } from '../server/db.js';
import { Counter } from '../server/models.js';
import { hashPassword } from '../server/lib/passwords.js';

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
// `cookie` is sent with every request, as a browser would.
let visitorNumber = 0;
export function newVisitor(app, cookie = '') {
  visitorNumber += 1;
  // Documentation-only addresses: IPv4 for the first 254 visitors, then IPv6.
  const ip = visitorNumber < 255 ? `203.0.113.${visitorNumber}` : `2001:db8::${visitorNumber.toString(16)}`;
  const send = (method) => (url) => {
    const req = request(app)[method](url).set('X-Forwarded-For', ip);
    return cookie ? req.set('Cookie', cookie) : req;
  };
  return {
    ip,
    get: send('get'),
    post: send('post'),
    put: send('put'),
    patch: send('patch'),
    delete: send('delete'),
  };
}

// The test owner. The hash is made once per test file: scrypt is slow on purpose.
export const OWNER = Object.freeze({ email: 'owner@example.com', password: 'a long test passphrase for the owner' });
let ownerHash;
export async function testOwner() {
  ownerHash ??= await hashPassword(OWNER.password);
  return { email: OWNER.email, passwordHash: ownerHash };
}

// Signs in and returns "name=value" for the Cookie header, plus a visitor that sends it.
export async function signIn(app) {
  const res = await newVisitor(app).post('/api/owner/login').send({ email: OWNER.email, password: OWNER.password });
  if (res.status !== 200) throw new Error(`Sign-in failed: ${res.status} ${JSON.stringify(res.body)}`);
  const cookie = res.headers['set-cookie'][0].split(';')[0];
  return { cookie, owner: newVisitor(app, cookie), res };
}

// A stand-in for the owner's Apps Script. `reply(channel, message)` returns { ok, error } or an
// Error to throw; it records every call. The secret never reaches it: that's the real notifier's job.
export function fakeNotifier(reply = () => ({ ok: true }), channels = ['email', 'sheet']) {
  const notifier = {
    channels,
    calls: [],
    reply,
    async send(channel, message) {
      notifier.calls.push({ channel, message });
      const answer = notifier.reply(channel, message);
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
  return notifier;
}

// Waits for the lead emails and sheet rows sent after the visitor's answer (routes/leads.js).
export function settle(app) {
  return Promise.all([...app.locals.pending]);
}
