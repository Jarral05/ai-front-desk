# 0006: Profiles (one app, several kinds of business)

Date: 11 Nov 2026. Status: decided. Why now: the owner wants to show the app in person to
children's hospitals in Mirpur, then schools and colleges.

## The choice

| Option | Why not |
|---|---|
| Copy the whole app per business | Every fix would be made twice, then five times |
| Many businesses in one running copy (one database, a business ID on every record) | The right end state before the 4th paying client, but it touches every query and every test. Too much for a demo |
| **A profile chosen at startup** | Chosen: one code base, one business per running copy, and Maple Lane Physio is untouched |

A profile is a frozen object in `server/lib/profiles.js`. `CLINIC_PROFILE` picks a built-in one.
`CLINIC_PROFILE_FILE` reads a private one from JSON, checked with zod (`strictObject`, so a
mistyped key is refused, not ignored).

## What a profile holds

Words: `kind`, `place`, `about`, `servicesTitle`, `demoNote`, `footerNote`. Settings: `currency`,
`contact` (`email` or `phone`). AI rules: `adviceInstead`, `emergencyRule`, `languageRule`. Fixed
answers that need no AI: `emergencyPatterns` and `emergencyReply`, `advicePatterns` and
`adviceReply`, `notSureText`. Starting facts: name, tagline, services, hours, facts, greeting,
"Try asking".

The first profile's values are the old fixed text, so `chatRules()` with no profile returns the
same text as 0.1.3. The existing test that compares the whole prompt still passes unchanged.

## Rules that came out of the real AI run (11 Nov, Gemini 3.5 Flash-Lite, free tier)

- **Medicine questions get a fixed refusal, not the AI.** "Which medicine for fever?" was the
  slowest question (3.4 to 5.4 s against 1 to 2 s) and timed out at 15 s twice in five tries. The
  cause isn't proven. A hospital's most important refusal now takes no AI call at all.
- **The "not sure" sentence is bilingual, not translated.** Rule 1 says "reply exactly", and the
  AI obeyed it in English even for an Urdu question, also after a rule allowing translation.
- **"Use everyday Pakistani Urdu words"** is in the language rule: one answer said "Shaniwar"
  (Hindi) for Saturday; after the rule it said "Hafta".

## Real names

This repository is public and holds only made-up businesses. A real hospital's name lives in a
private file outside it. Such a page always shows "Demo prepared for ... Not a live service", its
AI is told the facts are samples, and it runs on the owner's computer for a meeting. It doesn't go
on a public address without that business's written OK.

## Saved knowledge

Each profile has its own `Knowledge` document (`clinic` for the first, `clinic:<profile id>` for
the others). Without this, facts edited while showing one business would appear under the next
one's name.

## Looks and sample leads (added the same evening, still 0.1.4)

Why: a hospital owner judges the page and the dashboard, not the code. An empty dashboard and
physio colours make a demo look unfinished.

- **Colours are checked, not trusted.** `server/lib/brand.js` works out WCAG contrast for every
  place each colour is used (white on dark, accent on the page and on its own pale fill, dark on
  light). A private file with a colour under 4.5:1 stops at startup with the reason.
- **Colours reach the page through CSS variables set with `style.setProperty`.** The Content
  Security Policy (`style-src 'self'`) blocks `<style>` tags and `style=""` attributes, but not
  the style object.
- **Pale fills use `color-mix()`** from the accent, so one setting colours everything.
- **Logo: a file, never a URL.** Read once at startup from the profile's own folder, type taken from
  the first bytes, SVG refused (it can carry scripts). Rejected: a remote logo URL (the page would
  call another site, and the CSP would need loosening). Built-in profiles show initials instead.
- **Sample leads are real documents with `sample: true`**, so the dashboard, filters and CSV work
  exactly as they do for real leads, and they still delete themselves after 24 hours. Rejected:
  a fake list only in the page (it would show a dashboard that doesn't exist). Their scores come
  from `lib/score.js`, so a sample can't show a score the rules wouldn't give. They're not added
  to the daily counters; the page adds them and says so.

## Left for later

One running copy for many businesses; a per-business AI usage cap; a list of questions the AI
couldn't answer; school and college profiles.
