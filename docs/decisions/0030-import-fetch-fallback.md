# 30. Import fetch fallback and the author's words

Date: 2026-10-26
Status: Accepted
Builds on: 10 (the API owns import)

## Context

Two import failures had two causes. Google's URL fetcher could not load a
WordPress.com page that loads fine with an ordinary request. On another page,
Gemini refused to answer with `RECITATION`, because the prompt asked it to
keep the source's details, which it read as copying a published page.

## Decision

Gemini's URL tool stays the default fetch. When it reports that retrieval
failed, or it finds no recipe on the page, the API fetches the page itself
and gives Gemini the Recipe JSON-LD, the page description and the page
text. The text carries what sites keep outside structured data: optionals,
swaps and tips. The description carries what social posts show only there:
Instagram serves Google's fetcher a shell, and its caption sits only in the
`og:description` meta tag, so Instagram links skip Gemini's fetch entirely. A social post credits its creator, not the
platform.

The API only fetches the public internet. Every address a host resolves to
is checked at connect time, so a lookup cannot point the socket elsewhere,
and literal IPs and each redirect hop are checked too. Loopback, private,
link-local, CGNAT and IPv6 unique-local addresses are refused; the last
covers Fly's private network.

Imports keep the facts and rewrite the prose. Ingredients, amounts,
temperatures, times and doneness cues stay exact; steps, tips and notes are
in Magpie's words. The source link is always the URL the user imported,
set by the server, not the model.

## Consequences

- Pages behind bot checks or that only render with JavaScript still fail.
  A scraping service would fix that, at a cost per page and against the
  site owner's choice; the import logs show whether it is needed.
- A page with no recipe costs a second model call before the cook hears
  why.
- A refusal is a 422 `RECIPE_EXTRACTION_FAILED` with the finish reason in the
  log, not a 500.
