# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [0.1.5] - 2026-11-11

### Fixed

- `npm run dev` or `npm run dev:hospital` could show the previous business's page: an earlier copy
  left running (Ctrl+C in Git Bash doesn't always stop the server) kept port 3000, the new server
  couldn't start, and the new page talked to the old one. Every dev command now checks ports 3000
  and 5173 first (`scripts/check-ports.js`) and refuses to start with a message that says what to do.
- The page's dev server no longer moves to another port when 5173 is busy (`strictPort`).
- The server explains a busy port in words instead of a stack trace.

### Added

- `npm run stop` (`scripts/stop.js`): stops a copy of the app left on ports 3000 and 5173, including
  `node --watch`'s parent. Only Node programs are stopped; anything else is named and left alone.
- The server's start line names the business it shows, for example "listening on port 3000, showing
  Maple Lane Physio (Demo)".

## [0.1.4] - 2026-11-11

### Added

- Profiles (`server/lib/profiles.js`): the same app can show another kind of business. With no
  setting it is Maple Lane Physio, exactly as before. `CLINIC_PROFILE=childrens-hospital` (or
  `npm run dev:hospital`) shows a made-up children's hospital in Mirpur, "Nanhay Qadam Children's
  Hospital (Demo)": fees in rupees, a booking form that asks for a phone number (email optional),
  and answers in English, Urdu or Roman Urdu.
- Private profiles: `CLINIC_PROFILE_FILE` (or `npm run dev:private`) reads one business's starting
  facts from a JSON file kept outside this repository. The file is checked at startup and a mistake
  stops the app with a message that names it. The page and the AI both say it is a demo with
  sample fees.
- Fixed answers on the hospital profile that never use the AI: the emergency words a parent types
  (English, Roman Urdu and Urdu) send them to an emergency room; a medicine or dose question gets
  a fixed refusal; and the "I'm not sure" sentence carries English and Urdu.
- Each profile keeps its own saved knowledge, so an edit made while showing one business can't
  appear under another's name.
- Chat messages, the message box and the booking note use `dir="auto"`, so Urdu is laid out right
  to left.
- Each profile has its own colours (`brand`: dark, accent, light), checked at startup against WCAG
  AA contrast (4.5:1) wherever they're used, and the business's initials in a circle beside its
  name. The children's hospital is navy, orange and pale yellow.
- A private profile can add a logo file (PNG, JPEG or WebP by its first bytes, up to 300 KB, from
  the profile's own folder; SVG refused), served at `GET /api/logo`.
- "Fill with sample leads" on the owner's dashboard: six made-up leads per profile (the hospital's
  in Roman Urdu, Urdu and English, with English summaries), scored by the usual rules, each
  marked "Sample". Filling again replaces them; "Remove sample leads" deletes only samples. The
  numbers at the top add them and say "Includes 6 sample leads."

### Changed

- The Knowledge page's price error now reads "Use a whole number, for example 55." (was "whole
  dollars"), and its price label shows the profile's currency.
- The owner pages take the business name from the profile instead of fixed text.
- A lead's email may be empty when the profile asks for a phone number instead.
- Pale fills (the "Book an appointment" button, the thank-you box, hover states) follow the
  profile's accent colour instead of a fixed mint. On Maple Lane they look almost the same.
- The CSV file is named after the profile (`childrens-hospital-leads-...`); Maple Lane's name is
  unchanged.

## [0.1.3] - 2026-11-11

### Added

- Owner sign-in: a Show/Hide button on the password box, the same as the client portal's (an eye
  drawn in code, no icon package). It tells screen readers "Show password" or "Hide password" and
  whether it's on.

### Changed

- Owner sign-in: an empty box gets "Enter your email address and password." before anything is
  sent, in the same words on every browser (the form no longer shows the browser's own bubbles).
  Typing again clears the message. Phones no longer capitalise or correct the email or a visible
  password.
- Each sign-in label is joined to its box by ID, so screen readers call the boxes "Email address"
  and "Password", not "Password Show password".

## [0.1.2] - 2026-11-11

### Added

- Owner sign-in (Part 4): one owner account from settings (`OWNER_EMAIL`, `OWNER_PASSWORD_HASH`).
  The password is stored as a scrypt hash (Node's own crypto, OWASP's settings); `npm run
  hash-password` makes the hash with hidden typing. The same message for a wrong email or
  password, and 10 tries an hour from one place, counted before the check.
- Owner sessions without a package: a random 256-bit token in an HttpOnly, SameSite=Strict cookie
  (Secure and `__Host-` in production); only its SHA-256 is stored. 30 minutes idle, 8 hours at
  most, a new token at every sign-in, and a new password or owner email ends every older session.
  Requests from other websites are refused by an Origin check.
- Owner dashboard at `/owner`: leads newest first with Hot, Warm, Cold or Unscored badges, the
  reasons for each score, a score filter, New/Contacted, the last 7 days' chats, leads and Hot
  leads, and a CSV download protected against spreadsheet formula injection.
- Knowledge page at `/owner/knowledge` (Part 5): the owner edits services and prices, opening
  hours, facts and the welcome message; changes reach the clinic page, the booking form and the AI
  from the next message. One PDF (real PDF by its first bytes, 2 MB, 20 pages, 10-second timeout,
  images capped, scripts off): its text is kept, never the file, and the AI reads it in its own
  block with a rule never to follow instructions inside it. A 20,000-character cap on everything
  the bot knows. Remove the PDF, or reset everything to the demo facts.
- Footer link "Owner sign-in" on the clinic page.
- Decision record 0005. 76 tests in total (31 new), and a PDF maker for tests so no binary files
  are kept in the repo.

### Changed

- The chat greeting is now the owner's welcome followed by a fixed notice that always says it's an
  AI, that this is a demo, and that messages go to Google's Gemini.
- Text from the owner and from visitors can no longer contain the AI's block markers (`<<<` or
  `>>>`), in the chat rules and in lead summaries.
- Production refuses to start without `OWNER_EMAIL` and a valid `OWNER_PASSWORD_HASH`.
- Node.js 24 or later (was 22.22). New package: `unpdf` 2.1.0.

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
