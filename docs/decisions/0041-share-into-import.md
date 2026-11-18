# 41. Share a link or text into an import

Date: 2026-11-18
Status: Accepted
Builds on: 30 (fetched pages), 31 (text and photo imports), 34 (imports run as jobs)

## Context

Recipes are often found somewhere else: a TikTok or Instagram post, a
browser, a message. Copying the link, opening Magpie and pasting it is three
steps the share sheet can remove. Magpie had no share target on either
platform, so it never appeared there.

## Decision

Magpie accepts links and text from the system share sheet. On iOS a Share
Extension registers for web URLs, web pages and text; on Android `MainActivity`
registers for `ACTION_SEND` with `text/*`.

Sharing to Magpie starts a cookbook import for the active household at once
and moves to the Cookbook, where the existing job shows its progress or its
failure (ADR 34). Sharing is the cook's choice; there is no second
confirmation. A shared URL wins over a caption shared with it, so a post
imports the page rather than its caption. Text without a link is the recipe
itself, as when pasting (ADR 31).

A share that arrives before sign-in, onboarding or household access is kept
on the device and starts once the app can show it. It is claimed before the
job starts so a later launch cannot import it twice. The share extension has
no view of its own: it hands the content over and closes.

## Consequences

- The share target is native. It needs a new dev build and does not work in
  Expo Go (`expo prebuild --clean`, then the platform build).
- Each bundle variant gets its own iOS extension and App Group, so EAS
  credentials must include both.
- TikTok and Instagram still depend on the page fetch from ADR 30. A page
  behind a bot check still fails; sharing only removes the copy-and-paste,
  not the fetch.
- Photos and screenshots are not share targets yet. They already have a way
  in through the import sheet.
- More than one recipe still waits for review in the Cookbook (ADR 35).
