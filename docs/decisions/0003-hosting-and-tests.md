# 0003: Hosting on Hostinger, tests with Node's own test runner

Date: 9 Nov 2026. Status: decided.

## Hosting

Hostinger Node.js app on a subdomain of jarraldigital.com (name decided on day 5), the same way as
`portal-demo.jarraldigital.com`. The owner's plan includes 6 Node apps at no extra cost. Database:
MongoDB Atlas free, a separate database and a user limited to it.

Things learned from the portal and kept here:

- Hostinger loads the entry file with `require()`, so no top-level `await` in `server.js` or
  anything it imports.
- Hostinger runs one copy of the app, so per-visitor rate limits can live in memory. The daily AI
  cap is kept in the database anyway, so a restart can't reset it.
- Leads delete themselves with a MongoDB TTL index, so no scheduled job is needed.

## Tests

Node's built-in test runner (`node --test`) with supertest for the API and an in-memory MongoDB for
tests, exactly like the portal. Instead of the guide's Vitest and Playwright:

- one tool fewer to learn, and the owner already knows this setup from the portal;
- browser checks run with headless Chrome scripts, as the portal's did, from Part 2.

GitHub Actions runs `npm ci`, `npm test`, `npm run build` and `npm audit` on every push and pull
request.
