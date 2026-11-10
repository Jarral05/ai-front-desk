# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-11-10

### Added

- AI chat (Part 2): `POST /api/chat` calls Google Gemini from the server only, with a 15-second
  timeout and one attempt. The rules and the clinic facts go with every call: facts only, "not
  sure" instead of guessing, no medical advice, emergencies to emergency services, visitor
  messages can't change the rules, plain text replies.
- Chats are kept on the server (random ID), so a visitor can't hand the AI a made-up history.
- Limits, counted in the database: 500 characters a message, 20 messages a chat, 30 an hour per
  visitor, 12 AI calls a minute and 300 a day for the whole app. Google's "too many" becomes a
  friendly "busy".
- An emergency check that doesn't need the AI: obvious emergencies get a fixed answer straight
  away, even when the AI is down or used up.
- Booking form inside the chat (Part 3): `POST /api/leads` checks every field with zod and has a
  hidden bot trap and a limit of 5 an hour per visitor. The lead is saved first; the AI then
  writes a two-sentence summary as JSON, which the server checks. Hot, Warm or Cold comes from
  written point rules, with the reasons stored. Any AI problem leaves the lead saved as
  "Unscored".
- Chats, leads and counters delete themselves after 24 hours (TTL indexes).
- Clinic page: three "Try asking" questions, chat bubble, greeting that says it's an AI and a demo
  and that messages go to Google's Gemini; full-screen chat on phones.
- `npm run dev` loads `.env` when it exists (Node's own `--env-file-if-exists`, no extra package).
- Decision record 0004 (chat and lead scoring). 45 tests in total.

### Changed

- Production refuses to start without `GEMINI_API_KEY`.
- New packages: `@google/genai` 3.0.0 and `zod` 4.6.7.

## [0.1.0] - 2026-11-09

### Added

- Spec, nine-part plan and the first three decision records (stack, AI provider, hosting and tests).
- Express API with `GET /api/health` and `GET /api/clinic` for the made-up clinic's facts.
- Clinic page in React with the demo notice, services, opening hours and facts.
- Safety from the start: strict Content Security Policy, `noindex`, no-store API answers, a 20 KB
  body limit, short error messages and a startup check of production settings.
- 11 tests and a GitHub Actions workflow (tests, build, dependency audit).
