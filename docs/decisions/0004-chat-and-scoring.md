# 0004: How the chat calls Gemini, and how leads are scored

Date: 10 Nov 2026. Status: decided (day 2).

## Which Gemini call

`ai.models.generateContent` from `@google/genai` 3.0.0, with `systemInstruction`, the chat as
`contents`, and `responseMimeType` plus `responseJsonSchema` for the lead summary.

| Option | Why not |
|---|---|
| `ai.interactions.create` (new, shown on Google's get-started page) | Keeps the conversation on Google's side by ID. Here the app must decide what the AI sees, send the rules every time, and keep chats for 24 hours only, so the history stays in our own database |
| `ai.chats` | Keeps the history in the server's memory, which is lost on restart and grows with every visitor |
| **`ai.models.generateContent`** | Chosen: one call, nothing remembered, rules sent every time |

Settings: 15-second timeout, one attempt (`retryOptions: { attempts: 1 }`), temperature 0.3 for
chat and 0 for the JSON summary, at most 400 output tokens. Measured on 10 Nov: SDK 3.0.0 makes
one attempt by default anyway; the setting is kept so a later default can't change it.

## Where the chat history lives

On the server, in MongoDB, under a random UUID, deleted after 24 hours. The browser sends only the
ID and the new message. If the browser sent the whole history, a visitor could write fake
"assistant" turns to talk the AI out of its rules.

## Limits

Per message 500 characters; per chat 20 visitor messages; per visitor (IP fingerprint) 30 messages
and 5 bookings an hour; for the whole app 12 AI calls a minute and 300 a day, below Google's free
15 a minute and 500 a day. Counters are documents in MongoDB, increased with one atomic update, so
a restart can't reset them and two requests at once can't both slip through.

## Emergencies

A short list of patterns (chest pain, can't breathe, unconscious, heavy bleeding, overdose,
suicidal thoughts) gets a fixed answer before any limit or AI call. "Hurt myself" is left out on
purpose: at a physio clinic it is usually a sports injury.

## Lead score

The AI does not choose Hot, Warm or Cold. It returns a summary and an intent; the server checks
both with zod, then adds points:

| Signal | Points |
|---|---|
| Wants a time this week | +2 |
| Wants a time in the next two weeks | +1 |
| Named a service (not "Not sure") | +1 |
| AI intent "ready_to_book" | +1 |
| AI intent "question_only" | -1 |

3 or more = Hot, 2 = Warm, 1 or less = Cold. No valid AI answer = Unscored. The reasons are stored
with the lead, so the owner can see why.

The lead is saved before the AI is called, so a slow or failed AI can never lose it.
