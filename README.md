# AI Front Desk (demo)

[![Tests](https://github.com/Jarral05/ai-front-desk/actions/workflows/test.yml/badge.svg)](https://github.com/Jarral05/ai-front-desk/actions/workflows/test.yml)

A demo AI front desk for a made-up clinic, **Maple Lane Physio (Demo)**. A visitor chats with an AI
that answers only from the clinic's facts, then books through a short form. Each enquiry becomes a
lead with a short AI summary and a Hot, Warm or Cold score, and the owner sees it on a private
dashboard.

**Status:** in progress (Part 1 of 9). The clinic, its people and its prices are invented. No real
data is used anywhere.

Built with MongoDB, Express, React and Node.js, with Google Gemini for the AI. What it does:
[docs/SPEC.md](docs/SPEC.md). How it's built, part by part: [docs/PLAN.md](docs/PLAN.md). Why:
[docs/decisions/](docs/decisions/).

## Run it on your computer

Needs Node.js 22.22 or later.

```bash
npm install
npm run dev
```

Open http://localhost:5173. Without settings, the app uses a temporary in-memory database, so
nothing needs to be set up. Copy `.env.example` to `.env` only when connecting a real database.

## Checks

```bash
npm test        # every test, with a coverage report
npm run build   # builds the page into dist/
```

GitHub Actions runs the tests, the build and a dependency audit on every push and pull request.
