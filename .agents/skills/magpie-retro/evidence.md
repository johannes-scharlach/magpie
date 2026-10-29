# Reading Magpie evidence

## Access

Use the repository's Supabase CLI. `--linked` reads live Magpie; `--local` reads
the already-running local database. The linked project reference is in
`supabase/.temp/project-ref`. Check the target before reading.

Run SELECTs through `pnpm supabase db query --linked --output json --file PATH`.
Write the SQL and redirect its output into `.logs/magpie-retro/`. For example:

```sh
pnpm supabase db query --linked --output json --file .logs/magpie-retro/query.sql > .logs/magpie-retro/case.json
```

Use existing CLI authentication; keep credentials out of commands and exports.
If access fails, ask for access or a supplied export. Schema changes, service
starts and changes to the user's recipes or settings are separate actions.

## Find recent candidates

Start with an index. Set a useful window and scope `list_id` when reviewing a
particular household. This query shows at most five user messages per chat;
`user_message_count` reveals truncation. Expand a candidate before judging it.

```sql
select c.id, c.list_id, c.title, c.updated_at,
  c.recipe_id, c.initial_variant_id,
  (select count(*) from chat_messages m
    where m.chat_id = c.id and m.role = 'user') as user_message_count,
  (select jsonb_agg(to_jsonb(u) order by u.created_at, u.id) from (
    select m.id, m.created_at,
      (select string_agg(p->>'text', E'\n' order by n)
        from jsonb_array_elements(m.parts) with ordinality as part(p,n)
        where p->>'type' = 'text') as text
    from chat_messages m where m.chat_id = c.id and m.role = 'user'
    order by m.created_at desc, m.id desc limit 5
  ) u) as latest_user_messages
from chats c
where c.updated_at >= now() - interval '7 days'
order by c.updated_at desc, c.id desc limit 20;
```

The twenty-chat limit is a discovery window, not an exhaustive audit. Widen it
or page by `updated_at, id` when the requested scope requires more.

## Read the complete chat

Replace `<chat-id>` with the selected UUID. Preserve this raw export locally.
Read a compact projection first: text, tool inputs/results and turn status.
Opaque provider signatures and Google search UI HTML can dominate raw output;
omit them only from the reading view, keeping the raw evidence available.

```sql
select c.id as chat_id, c.title, c.recipe_id, c.initial_variant_id,
  c.planned_meal_id, m.id as message_id, m.role, m.parts, m.created_at
from chats c join chat_messages m on m.chat_id = c.id
where c.id = '<chat-id>'
order by m.created_at, m.id;
```

`parts` contains the evidence, not just the visible prose:

- `tool-readVariant`: the actual recipe snapshot read at that time.
- `tool-readPlannedMeal`: selected eaters, extra portions and ingredient choices.
- `tool-addToCookbook` / `tool-updateRecipe`: complete submitted recipe and the
  returned Variant ID when the write succeeded.
- `data-turn`: the initiating user message and completion state.
- File parts: media references; signed URLs may have expired. Missing media is
  a gap, not permission to infer what the photo or recording contained.

## Follow the recipe between chats

A general chat that created the recipe may have `recipe_id = null`. Its
successful tool result links it through a Variant. Recipe chats also preserve
their starting Variant; inspect that snapshot rather than substituting a newer
one. Given a `<recipe-id>` and `<list-id>` from the case:

```sql
select c.id, c.title, c.created_at, c.recipe_id, c.initial_variant_id
from chats c
where c.list_id = '<list-id>' and (
  c.recipe_id = '<recipe-id>' or exists (
    select 1 from chat_messages m
    cross join lateral jsonb_array_elements(m.parts) p
    join variants v on v.id::text = p->'output'->>'variantId'
    where m.chat_id = c.id and v.recipe_id = '<recipe-id>'
      and p->>'state' = 'output-available'
  )
)
order by c.created_at, c.id;
```

When starting from a general chat, resolve a successful save's Variant ID with
`select id, recipe_id from variants where id = '<variant-id>'` first. Read the
relevant related chats in chronological order. A planning chat can contain
several recipes; keep the investigation tied to the selected one.

## Inspect relevant current context

For a portion question:

```sql
select id, name, age_group, portion_reference, created_at, updated_at
from household_people
where list_id = '<list-id>'
order by created_at, id;
```

Use the saved tool calls for the meal's eaters and extra portions. Read other
profile fields only when relevant. Label these rows **current state**. Their
timestamps can support an inference but cannot replace a generation snapshot;
new columns can have migration defaults without changing `updated_at`.

## Recorded generation context

After ADR 37's migration and API release, new replies capture their initial
model input. Check availability first; old deployments and turns have no record.

```sql
select to_regclass('public.chat_generation_contexts') is not null as available;
```

When available, look up the selected assistant message:

```sql
select message_id, created_at, context
from chat_generation_contexts
where message_id = '<assistant-message-id>';
```

`context.input` holds the initial instructions (including household data), model
messages, prepared tool schemas and generation settings. `historyMessageIds`
links back to the selected UI messages. `response` adds the first response's
model ID when that step completed; it may still be an alias if the provider
does not report a resolved version. `build` is the Fly image reference when
available. Later tool results remain in the transcript.

This is initial model context, not a complete wire trace or a permanent media
archive. Missing rows, expired attachments and unresolved model aliases are
explicit evidence gaps. Code and profiles today show current behaviour, not
necessarily what an older generation received.

## Source map

- `apps/api/src/routes/chats.ts`: history selection, household reads, model
  choice and assembled instructions. Development and production use different
  models; both currently use mutable aliases.
- `apps/api/src/assistant-prompt.ts`: shipped cooking instructions;
  `docs/artifacts/system-prompt.md`: its documented source.
- `packages/profile/src/index.ts`: household rules and portion-reference meaning.
- `apps/api/src/recipe-schema.ts`: recipe structure and model-facing field guidance.
- `apps/api/src/chat-tools.ts`: tool instructions and writes.
- `apps/api/src/recipe-chat.ts`: starting recipe snapshots and recipe-chat guidance.
- `apps/api/src/chat-reply.ts`: persistence of completed and interrupted turns.
- `apps/api/src/chat-generation-context.ts`: initial context capture (ADR 37).
- `docs/decisions/0009-chats-in-the-database.md`,
  `0012-planned-meal-eaters.md`, `0014-recipe-chats.md` in that same directory:
  history, sizing and cross-chat recipe behaviour.

Read `docs/testing.md` before proposing tests and `docs/schema-changes.md` before
proposing data or sync changes. Existing check commands live in `package.json`,
`apps/api/package.json` and `.github/workflows/check.yml`.
