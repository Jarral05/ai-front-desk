# AI Front Desk: the build plan

Nine parts over five evenings or afternoons (9 to 13 Nov 2026), then the interview practice on
14 Nov. Each part ends with every test passing and a "done when" line. If a day runs over, the last
part of that day moves to the next day; nothing is skipped.

| Day | Parts |
|---|---|
| 1, Mon 9 Nov | 1 Skeleton, tests, GitHub Actions |
| 2, Tue 10 Nov | 2 Clinic page and AI chat · 3 Leads with AI summary and score |
| 3, Wed 11 Nov | 4 Owner login and dashboard · 5 Owner's knowledge and PDF |
| 4, Thu 12 Nov | 6 Email, Google Sheet and buyer demo view · 7 Security and AI quality check |
| 5, Fri 13 Nov | 8 Policies first, then live on Hostinger · 9 README, screenshots, v1.0.0 |

## Part 1: Skeleton, tests and the test robot

- Express API and a React page that shows the clinic name and facts from `GET /api/clinic`.
- Security headers, `noindex`, health check, JSON 404 for unknown API routes, no stack traces.
- Tests with Node's own test runner and supertest; a temporary in-memory database for tests.
- GitHub Actions: install, test, build, dependency audit.
- **Done when:** `npm test` passes, `npm run dev` shows the clinic page, and the first push to
  GitHub shows a green tick.

## Part 2: Clinic page and AI chat

- The full clinic page; chat bubble; three "Try asking" questions; AI greeting with the demo notice.
- `POST /api/chat`: Gemini, server side only, with a timeout. System rules: answer from the facts
  only, no medical advice, emergencies to emergency services, "I'm not sure" instead of guessing.
- Limits: 500 characters, 20 messages a conversation, 30 an hour per visitor, 300 AI calls a day
  (counted in the database).
- Tests with a fake AI: rules sent every time, limits refuse correctly, replies shown as plain text.
- **Done when:** a real question gets a correct answer from the facts, and all limit tests pass.

## Part 3: Leads

- The booking form inside the chat; `POST /api/leads` validates every field.
- AI writes a two-sentence summary and returns JSON; the server checks it. The score comes from
  written rules (for example: wants a time this week, or names a service = Hot).
- AI failure = lead saved as "Unscored". Leads delete themselves after 24 hours (database TTL).
- **Done when:** a sent form appears as a scored lead in the database, and a failed AI call still
  saves it.

## Part 4: Owner login and dashboard

- One owner account from settings (email plus a password hash), session cookie, rate-limited login.
  Changed on 11 Nov: Node's built-in scrypt instead of bcrypt (decision 0005).
- Dashboard: leads newest first, score badges, filter, New/Contacted, the last 7 days' numbers, CSV
  with formula-injection protection.
- **Done when:** signed out, every owner route refuses; signed in, the dashboard works on a phone.
  **Done 11 Nov** (tests, and the browser check on a 390 px phone screen).

## Part 5: The owner's knowledge

- Edit facts and greeting; upload one PDF (2 MB, 20 pages, real type checked, text kept, not the
  file); 20,000-character cap on everything the bot knows; reset to demo facts.
- **Done when:** after uploading the test PDF (Pilates class, 50 minutes, $25), the chat answers
  "How much is Pilates?" correctly. **Done 11 Nov:** "Pilates class is 50 minutes and costs $25,
  and prices include tax." (real Gemini, local).

## Part 6: Email, Google Sheet and buyer demo view

- Email to the owner's own address; Google Apps Script webhook with a shared secret; "Not sent"
  and Retry; "See what the owner sees" through an HttpOnly cookie.
- **Done when:** a test lead arrives by email and as a sheet row, and turning either off shows
  "Not sent" with a working Retry.
  **Built 12 Nov (0.1.6):** 123 tests, 12 protections broken on purpose and caught, a phone-width
  check with a stand-in script (15/15). **Owner's real Google run, 13 Nov:** checks 1 to 3 passed
  (email and row arrive, "sent" on the dashboard, `=1+1` shown as text). Check 4 showed "Not sent"
  with Retry; Retry turning it to "sent" with one row is still to be confirmed. Phone numbers became
  numbers: fixed in 0.1.7.

## Part 7: Security and AI quality check

- OWASP Top 10 and OWASP Top 10 for LLM Applications, item by item, each with a test or a reason.
- 12-question AI check, including attempts to change the rules, ask for medical advice, and pull
  out other visitors' data.
- **Done when:** every item is answered and every test passes.
  **Done 12 Nov:** `docs/security-check.md`, 20 OWASP items, 2 log lines added, the real AI check
  15/15 on run 2 (run 1: Google timeouts).

## Part 8: Live

- Privacy and Cookie policies updated **first** (Gemini, the demo's leads, its cookie).
- Hostinger Node app on a subdomain, MongoDB Atlas (own database and user), settings in the panel.
- **Done when:** the live site passes the same browser checks as local, and outside checks pass.

## Part 9: Show it off

- README with screenshots and the live link, demo script, `/work/` page text, version 1.0.0.
- **Done when:** the owner can show it in 2 minutes and answer the interview questions.
