# 0001: MERN stack, the same as the client portal demo

Date: 9 Nov 2026. Status: decided (owner, 6 Nov).

## Choice

Plain JavaScript (ES modules), Express 5 for the API, React 19 with Vite for the page, MongoDB
Atlas with Mongoose, Node 24 in development and on GitHub (22.22 or later on the host).
Changed 11 Nov: Node 24 or later everywhere, because the PDF reader `unpdf` needs it (decision 0005).

## Options considered

| Option | Why not |
|---|---|
| Next.js, TypeScript and Postgres on Vercel (the owner's 5 Nov guide) | Vercel's free Hobby plan is for non-commercial use only, and a portfolio piece that sells services is commercial |
| Python backend | Free Docker hosting needs a paid plan; the owner can't pay by international card |
| **MERN, like the portal** | Chosen |

## Why

- The owner's CV lists JavaScript, React, Node.js, Express and MongoDB, and describes this project
  as "MERN stack with Google Gemini". The app must match the CV.
- The portal demo already runs this stack on Hostinger, so hosting, security headers, tests and the
  release routine are proven and cost nothing extra.
- One language end to end is easier to explain in an interview.

TypeScript was left out on purpose: the portal is plain JavaScript, and checks on the server
(zod schemas) and tests cover the risks types would catch.
