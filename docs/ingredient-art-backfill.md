# Ingredient art backfill

Meals and Shopping use the same lookup. Bundled art and learned aliases come
first. The backfill only sees distinct ingredient names left after that reuse,
not shopping quantities, household IDs, or notes. Until an asset is available,
the tile stays usable with its text alone.

## Run one sheet

Apply the ingredient-art migrations first. From the repository root:

```sh
# Read-only count; needs DATABASE_URL in apps/api/.env or the environment.
pnpm --filter api ingredient-art:backfill

# Draw at most one paid sheet and publish its usable cells.
pnpm --filter api ingredient-art:backfill --run
```

For `--run`, also set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`GOOGLE_GENERATIVE_AI_API_KEY`, and `ART_MATTING_URL` for your intended
environment. The command uses the existing ADR 38 `/matte` endpoint; it does not
start any service. Check that the database and Storage URL belong to the same
Supabase project.

The default is a 2×2 grid. Use `--size 1` through `--size 4` to set the side
length for the **next** sheet. The command saves the assignment before drawing
to `apps/api/.logs/ingredient-art-sheet.json`. Keep that file and rerun the same
command to retry: published cells are left blank and unresolved cells keep
their original row and column. The command starts a fresh sheet only when the
previous sheet has no remaining misses. Use `--plan /path/to/sheet.json` to keep
separate checkpoints for different projects. Retrying a sheet uses a new image
call; the checkpoint stores positions, not the source render.

The command reports distinct unresolved names before the run, the outcome of
each assigned cell, and totals for published, missing, failed, cells to retry,
and all remaining names. Missing means there was no usable cutout (empty,
opaque, or clipped at the edge); a technical error is reported as failed.
Both stay unresolved and cause a nonzero exit status. Transparent image
checks cannot tell whether the generator drew the right food in a cell.
Review the first real batches in both surfaces before increasing the grid size
or enabling a schedule.

Start manually with 2×2 to keep the first paid trial small. Use read-only
distinct counts, published/attempted yield, and actual elapsed times from
several runs to decide if 4×4 saves calls without hurting recognizability, or
if enough misses accumulate to justify a daily run. No scheduler is configured.
