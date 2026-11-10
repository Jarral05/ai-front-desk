# AI Front Desk

Portfolio demo for a made-up clinic, "Maple Lane Physio (Demo)". MERN with Google Gemini, built like
`../demo-client-portal`. Spec: docs/SPEC.md. Plan: docs/PLAN.md. Decisions: docs/decisions/.
Learning files (outside this repo): `../ai-front-desk-beginners-guide.md`, `../ai-front-desk-build-log.md`.

## Commands
- Run the app: `npm run dev` (page on http://localhost:5173, API on 3000; loads `.env` if present)
- Every check: `npm test` then `npm run build`
- Production start: `npm start`

## How we work
- One part of docs/PLAN.md at a time. Every change comes with tests; run them and show the output.
- IMPORTANT: Claude never runs git commit, push, tag or merge, and never creates or merges pull
  requests. The owner does all Git and GitHub steps; Claude gives the exact commands.
- Never delete, skip or weaken a test to make it pass. Explain why it failed and fix the code.
- After any change: bump the version in package.json, add a CHANGELOG.md entry, and update both
  learning files in the same session.
- Ask before adding a package. Read its current docs first.

## Code rules
- Plain JavaScript ES modules. No top-level await in server.js or anything it imports (Hostinger
  loads it with require()).
- Validate every input on the server with zod, with a length limit on every field.
- Every outside call (AI, email, webhook) has a timeout and can never stop a lead from being saved.

## Security rules
- IMPORTANT: Never read, print or ask for .env or any secret. The owner adds secrets.
- The AI is called only from the server. Visitor messages and PDF text are untrusted: they never
  change the AI's rules, and are always shown as plain text.
- No real people's names, emails or client data anywhere. All demo data is made up.
