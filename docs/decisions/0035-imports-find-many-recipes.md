# 35. Imports find many recipes, and the cook confirms them

Date: 2026-10-27
Status: Accepted
Builds on: 31 (import from pasted text and photos), 34 (imports run as jobs)

## Context

Cooks bring whole cookbooks: a physical book photographed page by page, or a
collection they wrote themselves. Pages and recipes do not line up. A spread
holds one recipe, a page holds two, a recipe runs onto the next page, a photo
catches one and a half.

## Decision

Pasted text and photos are pages in order, and an import finds every recipe
in them. Nobody chooses a bulk mode first; what the import finds decides.

- Exactly one complete recipe is saved at once, as before.
- Anything more waits for review: every complete recipe, plus the recipes
  only partly there, each with what is missing ("The steps continue on page
  38."). Partial recipes are never completed by guessing and cannot be
  kept.
- Nothing complete fails, with what is missing.

The recipes waiting for review live on their import operation in
`import_operations`, not as recipes, so the cookbook and planning never see
them and a retry finds them instead of reading again. Open reviews sync to
the cook's devices and show in the cookbook, so they outlive the app process
and the import job. The cook keeps a choice with
`POST /v1/recipes/imports/:operationId/confirm`; discarding is the cancel
call. Confirm and cancel take the operation's lock, so a review ends once,
and its row leaves the devices with the same sync that brings the recipes.

Reading a book takes a while, so the cook who started the import gets a
push ("Found 24 recipes") that opens the review. A review decided before the
push goes out is not announced.

One import takes up to 20 photos or 200,000 characters of text. A longer
book is several imports.

## Consequences

- Fixing a partial recipe means importing its pages again, together.
- An import started from a meal slot that finds several recipes plans none
  of them. Its review shows in the cookbook, where the kept ones go.
- Photos are not stored. A review names the recipe and page, which finds the
  spot in the book.
