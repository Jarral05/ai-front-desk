# 0007: Lead email, the Google Sheet and the buyer's view

Date: 12 Nov 2026 (day 4). Sources read that day: Google's Apps Script pages on web apps, the
Content service, quotas, MailApp, bound scripts, LockService and Properties; the OWASP Top 10:2025
and Top 10 for LLM Applications 2025.

## One Apps Script for both email and the sheet

| Option | Why not |
|---|---|
| An email package (Nodemailer) and the `hello@` mailbox | A new package, and the business mailbox password on a public demo server: if the demo were ever broken into, so would be the mailbox |
| An email service (Resend, Brevo) | A new account, domain records, and the leads pass through one more company |
| **The owner's own Apps Script** | Chosen: no package, no mailbox password on the server, free, and the plan already had a Google Sheet webhook |

The script emails **only** the `NOTIFY_TO` address saved in its own settings, never an address it is
sent. So even a leaked secret can't turn it into a way to email strangers. The server writes the
subject, body and row; the script only checks the secret and delivers, so the logic stays where it is
tested.

What Google's pages changed in the design:

- A web app's event has no request headers, so the secret travels in the body.
- Output is "redirected to a one-time URL", so the server's request follows redirects.
- In a web app, a bound script can't use the active spreadsheet: the script opens the sheet by
  `SHEET_ID`.
- A free Gmail account can email 100 recipients a day: fine for a demo, not for a busy hospital.
- Google's pages say nothing on whether `appendRow` runs a leading `=` as a formula. So cells are made
  safe on the server (the same `'` guard as the CSV), and the owner's setup check books a lead named
  `=1+1` to see it shown as text.

## Sent after the answer, never before

The lead is saved and scored first, then the visitor gets the thank-you, then the email and row go
out. A slow or sleeping script never keeps the visitor waiting, and a failure only marks the lead
"Not sent". The tests wait for these background sends through `app.locals.pending`.

Retry can repeat something that actually arrived (the answer was lost, not the delivery). The script
keeps each lead once: column A holds the lead ID, and sent emails are remembered for 6 hours, the
longest Apps Script's cache keeps anything.

## The buyer's view

A random 256-bit token in an HttpOnly cookie, its SHA-256 on the lead, the same way the owner's
session works. No lead ID in the address, so there is nothing to change to see someone else's. The
example leads are built for each answer and never saved.

## Left for later

An alert (not just a log line) for the owner; Gemini's paid tier and a Workspace account's higher
email limit for a real client; GitHub Actions pinned to commits.
