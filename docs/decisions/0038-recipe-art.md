# 38. Every recipe gets clay art

Date: 2026-11-09
Status: Accepted
Builds on: 5 (API server on Fly), 27 (recipes belong to a household)

## Context

Seeded recipes ship with claymation art. Recipes the household saves show
only a gradient, so a planned week or a cookbook full of imports is hard
to scan. The seeded art came from a hand-run pipeline: sprite sheets from a
cheap Gemini image model, then `scripts/art-matting.py` to cut each dish
out. That matting (isnet saliency plus closed-form alpha matting) took a
lot of tuning, and nothing in JS reproduces it.

## Decision

The API draws art for every recipe it creates, after the transaction
commits. One image per recipe, on demand:

1. `gemini-3.1-flash-lite-image` draws one dish from the variant's name and
   description, with the art README's prompt on a flat `#808080`
   background.
2. `apps/art-matting`, a separate Fly app, runs `scripts/art-matting.py`
   unchanged and returns a cropped 512px WebP. It is reachable only over
   Flycast (`magpie-art-matting.flycast`), has no public IP, and suspends
   when idle.
3. The API uploads the WebP to the public `recipe-art` bucket and sets
   `recipes.art_path`, only while it is still empty.

Art belongs to the recipe, not the variant: adjusting a recipe keeps its
picture. A copy into another household (ADR 27) points at the same file.

Seeded recipes keep their bundled art, found by name. The app shows the
bundled art, else `art_path`, else the gradient. A recipe has no art until
its art arrives through sync.

`pnpm --filter api art:backfill` draws art for recipes that have none:
recipes from before this decision, and any whose drawing failed.

## Consequences

- Drawing never blocks or fails a save. A failed drawing is logged and the
  recipe keeps its gradient until the backfill.
- The matting service needs 2 GB (peak 1.66 GB at 1024px; 1 GB is killed
  for memory). Fly suspends machines up to 2 GB without swap, so it sits at
  that limit. Suspended machines cost storage only and resume in a few
  hundred ms. A deploy or host move discards the snapshot; the next request
  is a cold start of a few seconds.
- The service handles one image at a time, so two images never need memory
  together. On a shared CPU an image takes about 15 s; nobody waits on it.
- Art files are public. Their paths are recipe ids, which travel only
  inside a household or a link someone chose to share (ADR 28).
- Files are never deleted. A deleted recipe can leave its art behind, and a
  copy may still use it.
- A draw-time failure inside a suspended API machine can lose the job.
  The backfill covers it.

## Idea for later

Draw art in sprite sheets: a sweeper takes up to nine recipes without art
and draws one sheet with as many cells as it needs. The price is per
sheet, so this pays off only with enough new recipes a day.
