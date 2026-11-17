# 39. Magpie as a ChatGPT plugin (MCP app)

Date: 2026-11-16
Status: Accepted (direction); implementation staged
Relates to: 5, 9, 13, 22

## Context

In 2026 a ChatGPT "plugin" is a bundle in the Plugin Directory: skills plus an
MCP app (optionally MCP Apps widgets). The 2023 `ai-plugin.json` + OpenAPI
plugin is gone. One MCP server serves ChatGPT, Claude and other MCP clients.

Magpie already has the two halves of that bundle:

- `apps/api/src/chat-tools.ts` — `buildChatTools()` returns 12 AI SDK `tool()`
  objects: name, description, Zod `inputSchema`, `execute`. That is an MCP tool
  list minus JSON Schema. Zod 4.6's `z.toJSONSchema()` generates `inputSchema`;
  `tools/call` invokes `.execute`.
- `docs/artifacts/system-prompt.md` `## Skills` (8 sections;
  `apps/api/src/assistant-prompt.ts` ships 6). The API copy's comment already
  says the other two wait for their tools — skills and tools are paired here.
- `packages/profile` `profileContext(household, userId)` — the household brief
  that makes advice obey the user's decisions (product promise #2).
- Supabase Auth has an OAuth 2.1 server; the project already signs ES256 keys
  that `auth.ts` verifies locally.

`docs/specs/0001` and `0011` name the risk: "an empty composer reads as 'talk
to ChatGPT'" and "a chat-only first experience feels like 'I already have this
with ChatGPT'". A plugin made of skills alone would be exactly that. What
ChatGPT cannot do is write to *this household's* cookbook, calendar and
shopping list — the write tools land on the same Postgres tables PowerSync
syncs to every member's phone (ADR 9).

Direction signed off: **companion, MCP app, writes to the household plan are
allowed.**

## Decision

**Companion, not parity.** ChatGPT owns the transcript. Plugin conversations
are not Magpie chats: no `chats` or `chat_messages` rows, no mirroring, no
household-visible history. ADR 9's "server is the only writer" stays intact.
What crosses over is *state*, not conversation: recipes, planned meals and
shopping items written by the plugin appear in the app for the whole household.

**One MCP endpoint inside `apps/api`, not a new service.** Add `/mcp` as a Hono
route. Supabase's own MCP block assumes an Edge Function with an RLS-scoped
client; our tools use a direct `pg` pool with membership checks in code
(ADR 9, 22). Keeping the endpoint in the existing process reuses the tool
implementations unchanged — ADR 13's "persistence code stays twinned" must not
become a third copy. Pre-flight: the MCP SDK must survive the CJS esbuild
bundle (ADR 5).

**The tool list is generated, not rewritten.** `tools/list` derives from
`buildChatTools()` via `z.toJSONSchema()`; `tools/call` calls `.execute` with
the resolved `userId`, `listId` and a synthetic context. `googleSearch`
(`routes/chats.ts`) is dropped: ChatGPT has its own browsing. Add MCP tool
annotations — `readOnlyHint` on reads, `destructiveHint` on `unplanMeal` — so
the client can gate writes.

**Synthetic chat context.** Ten of the twelve tools need only `userId`,
`listId` and `today`. `planMeal` reads `context.chat.planned_meal_id` /
`recipe_id` and `addToCookbook` reads `context.chat.entry`; a `RecipeChat` with
all fields null satisfies both. Two tools are genuinely app-shaped and stay out
of v0:

- `addMealShoppingItems` derives `plannedMealId` and `expectedContentId` from
  a chat attached to a planned meal; a plugin conversation has none.
- `updateRecipe` → `writeChatVariant()` derives its idempotent variant id from
  `chatId` + `messageId` (`chat:...`). The 2026 MCP core is stateless, so no
  stable per-turn id exists to key retries on.

**Identity.** Supabase Auth's OAuth 2.1 server signs users in with the account
they already have; the OAuth access token is a standard Supabase JWT with
`aud: authenticated`, which `requireUser` already verifies against the project
JWKS. Add the unauthenticated protected-resource / discovery endpoints outside
`/v1`. Two new surfaces: an OAuth consent screen (Magpie has no web app) and a
`listId` resolution step — `list_members` is many-to-many, so a user in several
households needs an explicit choice. Pre-flight: confirm CIMD / RFC 9207
support, since the 2026 MCP spec deprecates DCR while Supabase's docs
emphasise it.

**Always-on guidance travels as `instructions` and a resource.**
`ASSISTANT_SYSTEM_PROMPT`, `PLAN_PROMPT` and `profileContext(household, userId)`
go in the MCP initialize `instructions` (ChatGPT reads server instructions
since 2026-05-26) and a resource read fresh per call, as `routes/chats.ts`
does per turn. `PLAN_PROMPT` is currently a local const in that route; move it
to a shared module so both surfaces use one copy. Chat-specific pieces
(`recipeChatPrompt`, `tagVocabularyContext` as built today, local time from the
request) are not carried over.

**Stages.** v0: ten tools, writes only on explicit request. v1: shopping writes
with an explicit `plannedMealId` input; `updateRecipe` once an idempotency id
exists. v2: MCP Apps widget for `<ideas>` / `<sketch>` and the "Save & plan"
button; extract skill files.

## Consequences

- **Skills are not bundled yet.** Per `writing-for-agents`, the `## Skills`
  block is one always-loaded ~100-line section with no frontmatter, no
  description and no trigger branches; bundled skills are reached on demand
  through a description that is a context pointer. Splitting it is a rewrite
  with its own eval, not a copy: Exploration, Sketching, "a recipe they already
  know" and Saving are branches; Pro Cook Operating Model and Tasting and
  Balancing are always-on reference that stay in `instructions`. The writing is
  negation-heavy and its steps have no completion criteria. There are already
  two copies of the prompt (`system-prompt.md` is the source of truth,
  `assistant-prompt.ts` a trimmed subset because the API ships as one bundle) —
  a third copy must not be created. One source of truth plus a build step that
  inlines into the TS module comes first. `.agents/skills/magpie-retro/SKILL.md`
  is the house style to follow.
- **The output format is coupled to the app.** `<ideas>` and `<sketch>` are
  parsed by the Expo renderer into a pager and a page (ADR 9). Until the widget
  exists, plugin replies need a plain-Markdown variant of the exploration and
  sketch skills, or the tags render literally. ADR 9's "everything the user
  does is a message" does not hold in ChatGPT; the commit becomes a sentence,
  with `PLAN_PROMPT`'s "only schedule meals the user explicitly selects" as the
  guardrail.
- **Plugin saves have `origin = null`.** `addToCookbook` copies
  `context.chat.entry`, which the synthetic chat leaves null. Spec 0011 counts
  recipes by `origin` for the first-run challenge, so recipes saved from
  ChatGPT do not count. Accepted consequence of "companion"; no schema change,
  and `docs/schema-changes.md` stays untouched. `created_by` is still the OAuth
  user, so household attribution holds.
- **No generation context for retros.** `chat_generation_contexts` is keyed to
  a `chat_messages` row. Plugin-generated recipes have no recorded model input,
  which `.agents/skills/magpie-retro` relies on. Retro evidence for companion
  output needs a different source.
- **Deep links point back into the app.** `addToCookbook` / `updateRecipe`
  return `magpie://variant/<id>` (`variants.ts`). Sharing that link in ChatGPT
  is the companion's explicit hand-off: the recipe lives in Magpie, not the
  chat.
- **Household-wide writes are authorised.** One member's ChatGPT session may
  change another member's plan and shopping list. Consent is per user, not per
  household. The existing "only on explicit request" rule is the guardrail; no
  separate household approval gate.
- **No chat mirroring means no offline or history story to maintain.** ADR 9's
  turn-outcome machinery (durable acceptance, partial replies, reconciliation)
  stays app-only.

## Open questions

- Where the OAuth consent screen lives (minimal HTML in `apps/api`, or a
  static site) and how `listId` is chosen for users in several households.
- Whether the plain-Markdown output variant lives in the skills or in a
  plugin-specific `instructions` addendum.
- When skill files are extracted, and whether `docs/specs/` gets a companion
  spec for the interaction.

## Not in this decision

- Directory submission, Plugin Directory listing, pricing / Pro.
- Any change to `chats`, `chat_messages`, `recipes.origin` or `chats.entry`.
- A widget, skill extraction, or `chat_generation_contexts` for plugin turns.
