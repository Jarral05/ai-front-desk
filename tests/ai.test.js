// The Gemini wrapper, with Google replaced by a fake network. Checks what is sent, that the
// key never goes into the address, and that failures turn into the app's own two kinds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AiError, createGeminiAi } from '../server/lib/ai.js';

function fakeGoogle(status, body) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url: String(url), init, body: init?.body ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
  return { calls, fetch };
}

const OK = { candidates: [{ content: { role: 'model', parts: [{ text: 'We open at 8am.' }] } }] };

test('no key, no AI: the app runs and says the chat is off', () => {
  assert.equal(createGeminiAi({ apiKey: '', model: 'm' }), null);
});

test('sends the rules as a system instruction and the chat with the right roles', async () => {
  const google = fakeGoogle(200, OK);
  const ai = createGeminiAi({ apiKey: 'test-key', model: 'gemini-test', fetch: google.fetch });
  const text = await ai.generate({
    system: 'RULES',
    messages: [
      { role: 'visitor', text: 'Hi' },
      { role: 'assistant', text: 'Hello' },
      { role: 'visitor', text: 'When do you open?' },
    ],
  });
  assert.equal(text, 'We open at 8am.');
  assert.equal(google.calls.length, 1);
  const [call] = google.calls;
  assert.match(call.url, /models\/gemini-test:generateContent/);
  assert.doesNotMatch(call.url, /test-key/); // the key travels in a header, not the address
  assert.deepEqual(call.body.contents.map((c) => c.role), ['user', 'model', 'user']);
  assert.equal(JSON.stringify(call.body).includes('RULES'), true);
});

test('asks for JSON in the given shape when a schema is passed', async () => {
  const google = fakeGoogle(200, OK);
  const ai = createGeminiAi({ apiKey: 'k', model: 'm', fetch: google.fetch });
  await ai.generate({ system: 'S', messages: [{ role: 'visitor', text: 'x' }], json: { type: 'object' } });
  const config = google.calls[0].body.generationConfig;
  assert.equal(config.responseMimeType, 'application/json');
  assert.deepEqual(config.responseJsonSchema, { type: 'object' });
});

test('Google saying "too many" (429) becomes "busy", and is not retried', async () => {
  const google = fakeGoogle(429, { error: { code: 429, message: 'Resource exhausted', status: 'RESOURCE_EXHAUSTED' } });
  const ai = createGeminiAi({ apiKey: 'k', model: 'm', fetch: google.fetch });
  await assert.rejects(ai.generate({ system: 'S', messages: [{ role: 'visitor', text: 'x' }] }),
    (error) => error instanceof AiError && error.kind === 'busy');
  assert.equal(google.calls.length, 1);
});

test('any other failure becomes "failed", tried only once', async () => {
  const google = fakeGoogle(500, { error: { code: 500, message: 'Internal', status: 'INTERNAL' } });
  const ai = createGeminiAi({ apiKey: 'k', model: 'm', fetch: google.fetch });
  await assert.rejects(ai.generate({ system: 'S', messages: [{ role: 'visitor', text: 'x' }] }),
    (error) => error instanceof AiError && error.kind === 'failed');
  assert.equal(google.calls.length, 1);
});
