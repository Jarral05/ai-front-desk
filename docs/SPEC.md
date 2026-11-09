# AI Front Desk: what it does (spec)

A portfolio demo, built from an empty folder. A visitor chats with an AI on the website of a
made-up clinic, **Maple Lane Physio (Demo)**, and books through a short form. The owner gets every
lead scored, emailed and added to a Google Sheet, and can change what the bot knows without a
developer.

Everything in it is invented. No real clinic, person or client data, ever.

## Who uses it

**The visitor (someone looking for a physio).** Lands on the clinic page, clicks the chat bubble or
one of three "Try asking" questions. The chat says straight away that it's an AI and that this is a
demo, so they should use made-up details. It answers from the clinic's facts only. Asked for medical
advice, it says it can't give any and suggests booking an assessment; told about an emergency, it
says to contact emergency services now. When they want to book, a short form opens inside the chat.
They send it and see a thank-you.

**The owner (the clinic).** Signs in to a private dashboard. Sees leads newest first, each with a
two-sentence AI summary and a Hot, Warm or Cold badge, filters by score, marks a lead Contacted,
sees this week's numbers (chats, leads, Hot leads) and downloads a CSV. Each lead was also emailed
to them and added to their Google Sheet; if either failed, the lead shows "Not sent" with a Retry
button. On a Knowledge page they edit the clinic facts and the greeting, upload one PDF (a price list
or FAQ) the bot then answers from, or reset everything to the demo facts.

**The buyer (a business owner judging the demo).** After sending the form, clicks "See what the
owner sees" and gets their own lead exactly as the owner would see it, next to the example leads.
They never see anyone else's lead.

## Features

1. One-page clinic website with an AI chat bubble and three "Try asking" questions.
2. The chat says it's an AI at the start, answers only from the clinic's knowledge, never gives
   medical advice, sends emergencies to emergency services, and says it isn't sure instead of
   inventing answers.
3. A booking form inside the chat. Each enquiry becomes a lead with a two-sentence AI summary and a
   Hot, Warm or Cold score from written rules. If the AI fails, the lead is saved as "Unscored".
4. Every new lead is emailed to the owner and sent to a Google Sheet through a webhook. If either
   fails, the lead is still saved and shows "Not sent" with Retry.
5. Private owner dashboard: score badges, score filter, New/Contacted status, this week's numbers,
   CSV download.
6. The owner edits the facts and greeting, uploads one PDF, and can reset to the demo facts.
7. Buyer demo view: a visitor's own lead only, found through an HttpOnly cookie, never an ID in the
   address.

## Clinic facts (all invented)

- Services: first assessment, 60 minutes, $80. Follow-up treatment, 40 minutes, $55. Sports
  massage, 45 minutes, $50. Online video consultation, 30 minutes, $40.
- Opening hours: Monday to Friday 8am to 7pm, Saturday 9am to 1pm, closed on Sunday.
- Patients: adults and teenagers aged 14 and over.
- Address: 12 Maple Lane, Sampletown. Free parking behind the clinic.
- No doctor's referral needed. Wear loose clothing.
- Cancellation: 24 hours' notice, or the full fee is charged.
- Insurance: we give an invoice to claim from your insurer; we don't bill insurers directly.

## Safety rules

- Secrets only in `.env` (ignored by Git) and in the host's settings. The AI is called only from
  the server; the key never reaches the browser.
- Every input is checked on the server with a schema and a length limit.
- Owner login: password stored as a strong hash, an HttpOnly, Secure, SameSite cookie that expires,
  rate-limited attempts, and the same message for a wrong email or a wrong password.
- Every owner page and route refuses anyone not signed in.
- Chat limits: 500 characters a message, 20 messages a conversation, 30 messages an hour per
  visitor, 300 AI calls a day for the whole app. The daily count is kept in the database, so a
  restart can't reset it.
- Chat messages and PDF text are untrusted. They can't change the AI's rules, the AI can't see other
  visitors' data or the database, and AI replies are shown as plain text.
- CSV downloads are protected against spreadsheet formula injection.
- Security headers, including a strict Content Security Policy, and `noindex`.
- Demo privacy: the chat asks for made-up details, and leads delete themselves after 24 hours.
  Gemini's free tier lets Google use what's sent to improve its products, so the chat says so, and
  the Privacy Policy is updated before go-live.
- Checked against the OWASP Top 10 and the OWASP Top 10 for LLM Applications (day 4).

## Tests

Every rule above gets a test. The AI, email and webhook are faked in tests, so tests never cost
money or send anything. GitHub Actions runs every test, the build and a dependency audit on every
push and pull request. A part is done only when every test passes, on this computer and on GitHub.

## Design

Header and footer `#0F1E33`, buttons and chat header `#0F766E`, accents `#5EEAD4`, page background
`#F8FAFC`, text `#0F172A`, quiet text `#5B6B7F`. Score badges: Hot `#B91C1C` on `#FEE2E2`, Warm
`#B45309` on `#FEF3C7`, Cold `#1D4ED8` on `#DBEAFE`. Fonts: Sora for headings, DM Sans for text.
Works well on a phone.
