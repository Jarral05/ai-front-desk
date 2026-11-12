# Lead email and Google Sheet: setup

About 10 minutes, once. You need your own Google account. Nothing here costs money.

Google's own pages, read 12 Nov 2026: [Web apps](https://developers.google.com/apps-script/guides/web),
[Content service](https://developers.google.com/apps-script/guides/content),
[Properties](https://developers.google.com/apps-script/guides/properties),
[Quotas](https://developers.google.com/apps-script/guides/services/quotas) (a free Gmail account can
send email to 100 recipients a day). If a screen looks different from these steps, Google's screen
is right.

## 1. Make the secret

In the `ai-front-desk` folder:

```bash
npm run make-secret
```

It prints one long line. Keep this window open; you paste the line in two places below. Don't send it
to anyone, and don't put it in a chat.

## 2. The sheet

1. Open [sheets.new](https://sheets.new). Name it, for example, "AI Front Desk leads".
2. Copy its **ID** from the address bar: the long part between `/d/` and `/edit`.

## 3. The script

1. In the sheet: **Extensions → Apps Script**.
2. Delete what's in `Code.gs` and paste the whole of [`apps-script/Code.gs`](../apps-script/Code.gs).
   Press **Save** (the disk icon).
3. **Project Settings** (the gear on the left) → **Script Properties** → **Add script property**,
   three times:

| Property | Value |
|---|---|
| `NOTIFY_SECRET` | the line from step 1 |
| `NOTIFY_TO` | the email address the leads should go to (your own) |
| `SHEET_ID` | the ID from step 2 |

   Press **Save script properties**.

## 4. Publish it as a web app

1. **Deploy → New deployment**. Next to "Select type", click the gear → **Web app**.
2. **Execute as: Me**. **Who has access: Anyone**. (The secret is what keeps others out; Google's
   "Anyone" only means no Google sign-in is needed to send to it.)
3. **Deploy**. Google asks you to **Authorize access**: choose your account. If it says "Google hasn't
   verified this app", that's normal for your own script: **Advanced → Go to … (unsafe) → Allow**. It
   asks for your sheets and for sending email as you.
4. Copy the **Web app URL**. It ends in `/exec`.

## 5. Tell the app

Add two lines to `.env` (you type them; Claude never opens this file):

```
NOTIFY_WEBHOOK_URL=the URL from step 4
NOTIFY_SECRET=the same line as in step 1
```

Run `npm run stop`, then `npm run dev` again. A wrong address or a short secret stops the app with a
message saying which.

## 6. Check it (Part 6 is "done" when all four pass)

1. Book from the chat with a made-up name. Within a few seconds: an email "New … lead: …" arrives, and
   the sheet has a header row and the lead.
2. On the dashboard, the lead shows **Email: sent · Sheet: sent**.
3. Book again with the name `=1+1`. The sheet must show `=1+1` as text, **not** `2`.
4. In Script Properties, change `NOTIFY_SECRET` by one letter and save. Book again: the lead shows
   **Not sent** twice, with Retry. Put the right secret back, press **Retry** on both: they turn to
   **sent**, and the sheet has the lead **once**.

## Changing the script later

Edit, Save, then **Deploy → Manage deployments → ✏ (edit) → Version: New version → Deploy**. The URL
stays the same, so `.env` doesn't change.

## Switching it off

Delete the two lines from `.env` and restart. Leads still save and show on the dashboard; the
"Email/Sheet" line disappears. `NOTIFY_CHANNELS=sheet` (or `email`) keeps only one of them.
