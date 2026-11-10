// The one place that talks to Google Gemini. Everything else gets a small object with a
// `generate()` function, so the tests can hand in a fake AI that costs nothing.
import { GoogleGenAI } from '@google/genai';
import { LIMITS } from '../config.js';

// What went wrong, in words the routes can act on.
export class AiError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind; // 'busy' (Google said too many), 'failed' (anything else, timeouts too)
  }
}

// `fetch` is only passed by the tests, to see exactly what would be sent to Google.
export function createGeminiAi({ apiKey, model, fetch }) {
  if (!apiKey) return null;
  const client = new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: LIMITS.aiTimeoutMs,
      // One attempt, then a clear answer. SDK 3.0.0 already tries once unless retries are switched
      // on (measured 10 Nov), but its retry setting defaults to 5 tries with waits of up to a
      // minute, so this is set explicitly: a later SDK default can't burn the free quota or leave
      // a visitor waiting. tests/ai.test.js checks it.
      retryOptions: { attempts: 1 },
      ...(fetch ? { fetch } : {}),
    },
  });

  // messages: [{ role: 'visitor' | 'assistant', text }]. json: a JSON schema for the reply.
  return {
    async generate({ system, messages, json, maxOutputTokens = 400 }) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: messages.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.text }],
          })),
          config: {
            systemInstruction: system,
            maxOutputTokens,
            temperature: json ? 0 : 0.3,
            ...(json ? { responseMimeType: 'application/json', responseJsonSchema: json } : {}),
          },
        });
        return response.text ?? '';
      } catch (error) {
        if (error?.status === 429) throw new AiError('busy', 'The AI is busy.');
        // Log the kind of failure, never the visitor's text or the key.
        console.error('AI call failed:', error?.status ?? '', error?.name ?? 'Error');
        throw new AiError('failed', 'The AI could not answer.');
      }
    },
  };
}
