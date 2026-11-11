# AI Front Desk (demo)

[![Tests](https://github.com/Jarral05/ai-front-desk/actions/workflows/test.yml/badge.svg)](https://github.com/Jarral05/ai-front-desk/actions/workflows/test.yml)

A demo AI front desk for a made-up clinic, **Maple Lane Physio (Demo)**. A visitor chats with an AI
that answers only from the clinic's facts, then books through a short form. Each enquiry becomes a
lead with a short AI summary and a Hot, Warm or Cold score, and the owner sees it on a private
dashboard.

**Status:** in progress (Parts 1 to 5 of 9: the clinic page, the AI chat, scored leads, the owner's
dashboard and the owner's knowledge with a PDF). The clinic, its people and its prices are invented.
No real data is used anywhere.

Built with MongoDB, Express, React and Node.js, with Google Gemini for the AI. What it does:
[docs/SPEC.md](docs/SPEC.md). How it's built, part by part: [docs/PLAN.md](docs/PLAN.md). Why:
[docs/decisions/](docs/decisions/).

## Run it on your computer

Needs Node.js 24 or later.

```bash
npm install
npm run dev
```

Open http://localhost:5173. Without settings, the app uses a temporary in-memory database, so
nothing needs to be set up. To try the AI chat, copy `.env.example` to `.env` and add your own
Gemini key from Google AI Studio; `npm run dev` loads it. Without a key the page still works, the
chat says it's switched off, and bookings are saved unscored.

To try the owner's dashboard, run `npm run hash-password`, put the printed line and your email in
`.env` as `OWNER_PASSWORD_HASH` and `OWNER_EMAIL`, restart, and open http://localhost:5173/owner.

## Other businesses (profiles)

The app can show a different made-up business without a second copy of the code:

```bash
npm run dev:hospital   # a made-up children's hospital: rupees, phone number, English and Urdu
```

A profile holds the words and settings that differ (clinic or hospital, currency, email or phone,
languages, fixed safety answers) and the starting facts. `CLINIC_PROFILE` chooses a built-in one;
`CLINIC_PROFILE_FILE` reads a private one from a JSON file outside this repository. Why:
[docs/decisions/0006-profiles.md](docs/decisions/0006-profiles.md).

## Checks

```bash
npm test        # every test, with a coverage report
npm run build   # builds the page into dist/
```

GitHub Actions runs the tests, the build and a dependency audit on every push and pull request.
