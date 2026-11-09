# 0002: Google Gemini, free tier

Date: 9 Nov 2026. Status: decided (owner, 6 Nov); model checked 9 Nov.

## Choice

Google Gemini through the official `@google/genai` package, called only from the server. Model set
by `GEMINI_MODEL`, default `gemini-3.5-flash-lite`.

## Options considered

| Option | Why not |
|---|---|
| OpenRouter (the 5 Nov guide) | Free models allow 50 requests a day until $10 is bought, and the owner can't pay by international card |
| **Gemini free tier** | Chosen: free, Pakistan is a supported region |

## What Google's pages said on 9 Nov 2026

Read on aistudio.google.com/docs (pricing, rate limits, get started, regions, models):

- Free tier includes `gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite` and
  `gemini-3.1-flash-lite`. `gemini-3.5-flash-lite` is listed as stable.
- **On the free tier, "content used to improve our products": Yes.** So the chat tells visitors
  this is a demo and to use made-up details, and the Privacy Policy says so before go-live.
- Rate limits are per project, not per key; daily quotas reset at midnight Pacific time. The exact
  free numbers are only shown in the AI Studio dashboard. On the "Ai FrontDesk" project (9 Nov):
  **`gemini-3.5-flash-lite` allows 15 requests a minute, 250,000 tokens a minute and 500 requests a
  day**; the Flash models allow only 5 a minute and 20 a day. So the app keeps its own, lower caps
  for the whole app: **12 AI calls a minute and 300 a day**, and answers Google's "too many" (429)
  with a friendly "busy, try again in a minute".
- `gemini-2.5-flash` routes to `gemini-3.5-flash-lite` from 1 Dec 2026, so don't use 2.5 models.
- Pakistan is on the list of available regions.
- The get-started page now shows a newer "Interactions" call (`ai.interactions.create`). Read the
  package's current docs on day 2 before writing the chat code, and use whichever call the docs
  recommend for chat with a system instruction and JSON output.

## Safety

The key lives in `.env` and the host's panel only. Every call has a timeout. If the AI fails, the
chat says so politely and a lead is still saved ("Unscored").
