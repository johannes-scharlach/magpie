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

# Recheck queued names against published art, draw one sheet, and stage cutouts.
pnpm --filter api ingredient-art:backfill --run

# After opening a staged WebP and confirming that it depicts its assigned food:
pnpm --filter api ingredient-art:backfill --approve 'CELL:DIGEST'
```

For `--run`, also set `SUPABASE_URL`, `GOOGLE_GENERATIVE_AI_API_KEY`, and
`ART_MATTING_URL`; set `TYPESAFE_AI_API_KEY` once the registry has generated
art. A clear match removes a queued miss without drawing it. An uncertain
name stays queued but is not drawn. The command uses the existing ADR 38
`/matte` endpoint and does not start any service.

Publishing needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Check that the
database and Storage URL belong to the same project. Inspect each actual
staged WebP printed by `--run`: leave wrong or ambiguous subjects unapproved.
Repeat `--approve` for multiple cutouts. Use the exact code printed by the
preview run; the digest binds the bytes to the project, ingredient and cell.
Approval does not call a model.

The default is a 2×2 grid. Use `--size 1` through `--size 4` to set the side
length for the **next** sheet. The command saves the assignment before drawing
to `apps/api/.logs/ingredient-art-sheet.json`. Keep that file and rerun `--run`
to redraw rejected cells: published cells are left blank and unresolved cells keep
their original row and column. The command starts a fresh sheet only when the
previous sheet has no remaining misses. Use `--plan /path/to/sheet.json` to keep
separate checkpoints for different projects. Retrying a sheet uses a new image
call; the checkpoint stores positions, not the source render.

The command reports distinct queued or drawable names, per-cell outcomes,
and approval totals. Missing means there was no usable cutout (empty,
opaque, or clipped at the edge). Missing and technical failures stay unresolved.
A transparent cutout is not proof of the right subject; only visual review can
clear that gate.
Review the first real batches in both surfaces before increasing the grid size
or enabling a schedule.

Start manually with 2×2 to keep the first paid trial small. Use read-only
distinct counts, published/attempted yield, and actual elapsed times from
several runs to decide if 4×4 saves calls without hurting recognizability, or
if enough misses accumulate to justify a daily run. No scheduler is configured.

## Runtime boundary

The request/response use-up assessment runs as a Supabase Edge Function. It
receives the authenticated mobile plan snapshot and does not access the plan
database. Set `TYPESAFE_AI_API_KEY` in its Edge runtime.

Ingredient-art lookup uses Fly's process-wide Postgres pool for the private
alias and asset registry. It also shares in-flight model lookups across
callers until the alias write finishes, even if the original requester leaves.
The tables stay unavailable to app clients. Generation and subject review are
manual commands outside any mobile request; the matting call can run for up to
five minutes against the existing service.
