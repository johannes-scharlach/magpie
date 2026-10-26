# Magpie

Expo + PowerSync + Supabase. Read `docs/decisions/` before architectural
changes, `docs/schema-changes.md` before touching the schema or sync rules.
`CLAUDE.md` is a symlink to this file.

## Product promise

Magpie exists to return control over food to the user. Control means three
things, and all three must hold together:

1. **You decide for yourself.** The user sets the boundaries, defaults and
   priorities. Magpie helps carry out those choices rather than substituting
   its own idea of how the user should eat.
2. **Your decisions are put into practice.** Choices must guide actual
   suggestions, meal plans and ingredient sourcing, not just be stored as
   profile data. Better wording alone does not fulfil this promise.
3. **Nothing overwhelms you.** Magpie takes on planning and coordination.
   More settings, questions or manual work do not automatically mean more
   control.

Onboarding establishes this relationship. Treat it as the user setting how
Magpie should work, not merely filling out a profile. Ask directly for the
intended behaviour where possible instead of collecting a proxy and guessing
the rule. Each answer should make clear: "Because I chose this, Magpie will..."

Facts and firm boundaries still matter: equipment, household portions and
allergies do not need to become preference settings. Use the smallest useful
question, explain its consequence, and avoid making users configure every
detail.

## Commands

- Format with `pnpm format`: Prettier defaults, plus `deno fmt` for
  `supabase/functions` (needs a global `deno`).
- Verify with `pnpm typecheck` and `pnpm lint`. Mobile tests:
  `pnpm --filter mobile test`. Read `docs/testing.md` before adding or
  restructuring tests.
- The Supabase CLI is a dev dependency, not a global: `pnpm supabase <cmd>`.
- `pnpm stack:up` runs `supabase start` before `docker compose up` — the
  compose file needs the Docker network Supabase creates. `mongo-rs-init`
  sitting in "Exited (0)" is success.
- Expo Go works via `@powersync/adapter-sql-js` (JS-only SQLite, in-memory,
  alpha — dev convenience only). Native dev builds use op-sqlite: `pnpm ios`
  once, then `pnpm dev`.
- Seeded login: `dev@magpie.local` / `magpie-dev`.
- `pnpm api` runs the Hono server (`apps/api`); `pnpm api:deploy` ships it
  to Fly.io from the repo root, which is where the Docker context has to be.

## Constraints

- `supabase/` is Deno and outside the pnpm workspace on purpose. Shared
  edge-function code goes in `supabase/functions/_shared/`, never `packages/`.
- Pure rules both `apps/api` and `apps/mobile` need go in `packages/` as one
  `src/index.ts` (`@magpie/meals`, ADR 13). Persistence code stays twinned.
  The API Dockerfile copies each package explicitly.
- op-sqlite build flags (SQLCipher, FTS5) go in the root `package.json`
  (modules hoist there), not `apps/mobile/package.json`.
- Streaming and long-running work goes in `apps/api`; request/response work
  stays in `supabase/functions`. ADR 5 has the split.
- `apps/api` ships as one esbuild bundle (`dist/index.cjs`) with no
  `node_modules` in the image, so its deps come from the workspace lockfile.
  CJS, not ESM — the Dockerfile says why.

## Conventions

- Files are kebab-case.
- Repo files are either tracked or gitignored, never left untracked.
- `tickets/` and `supabase/snippets/` are local-only (ignored). Stale
  copies that search finds are worse than absent — agents trust what
  they find. Give agents explicit paths when one is needed; reading
  ignored files by path works fine.

## Communication

### When talking about the code base

Respond terse. Simple language is best. Technical substance stays. Avoid fluff and jargon.

### UX Copy

Tell people what the app will do, in words you’d actually say out loud—not slogans, vague promises, or forced friendliness.

## Design philosophy

Normal flow: Framing -> Shaping -> User sign-off -> Implement
Simple ask: just do it.

During shaping, ask "What would Kent Beck say?" to avoid premature abstractions and features nobody asked for. Stop and simplify the shape before presenting the plan.

During implementation, also ask "What would Kent Beck say?" to write clear code and refactor well. Prefer simple things, small safe steps, and designs that match the problem.

## Testing philosophy

Tests are supposed to guide us _to the right design faster_. Antipattern: first write the code and then think about testing.
The right way: think of how you want to test the behavior we want to implement. Write the simplest test that gives honest confidence. Then implement. Then repeat until everything is done.

There are two levers: discovering the right design and being faster. Both are key. Writing tests after implementation is inherently bad and if you ever feel the need to do that, you must get explicit user permission. It only makes sense to write tests for existing code if we're about to refactor or change behavior.

## Environment control

You're a guest on the user's machine. You never erase data, start or stop services without explicit user consent.

This also extends to things like build and dev scripts. The user owns those and you only advise on it. It's normal for the user to always have the dev script running.

Never run deployments or trigger deployment workflows. The user or CI handles deployments.

## Delegation

Generally avoid delegating implementation. In particular implementation where craft truly shines. You can of course delegate anything where details don't matter so much.
If in doubt, ask the user if it's a good task to delegate or not.
