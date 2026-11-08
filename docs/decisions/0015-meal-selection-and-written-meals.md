# 15. Choose recipes by group; a meal can stand alone

Date: 2026-09-23
Status: Accepted

Shopping amendment: [ADR 16](0016-intentional-meal-shopping.md) makes repeating
a meal calendar-only; shopping choices are made separately for the new meal.

## Decision

- Meal selection ranks candidates with Jev through the AI SDK's direct TypeSafe
  provider (2026-11-08 amendment). Opening a slot reads the relevant household
  choices, the preceding fourteen days and all upcoming planned meals (including
  other slots on the selected day, excluding only the slot being chosen), and up to 100 candidates:
  at most 80 newest cookbook additions, each using its latest variant, filled
  with distinct bundled seeded recipes. A short library is not padded.
  One Noul judgment per candidate assesses contextual fit against the household's
  profile, brief, selected slot and existing choices. Its numeric value determines
  rank, with no weighted formula, verbal rating levels or separate repetition
  adjustment. Requirements, preferences and acceptable options keep their meaning;
  requested minimums are not maximums. Familiarity and repetition are judged in
  light of the brief, including requested repeats. Calendar week membership and
  known same-meal occurrences are supplied as facts rather than scoring rules.
  Cookbook recipe identities and the bundled seeds' base ideas establish known
  near-repeats even when their names, cheese or sauces differ.
  Firm-boundary conflicts are excluded, not silently adapted. This is model
  judgment, not verified allergy safety. After ranking individual fit, a second
  Jev pass removes minor spins of higher-ranked meals. Known meal families already
  have one representative. Up to ten distinct alternatives for the one selected
  slot are shown; the user builds the plan one meal at a time. A short selection
  is not padded with near-duplicates. Seeded
  recipes enter the cookbook only when selected.
  Browse cookbook remains available while loading or offline, and opens a native
  stack screen with search. Failures offer retry rather than unranked suggestions.
- Cookbook browsing also shows one row per recipe. Search finds the latest
  matching variant per recipe and labels older matches. Other variants remain
  explicitly accessible. Equal timestamps use the variant id as a stable tie-break.
- The user-facing term is variant: alternatives remain valid alongside each
  other. Latest-first is the current selection rule, not a replacement history.
- Plan again copies the exact historical variant, eaters and extra portions to
  an empty destination. New shopping items are unpurchased. History is unchanged.
- A written meal stores `planned_meals.name` with null recipe and variant ids.
  Saving is local and creates no cookbook entry or shopping items. Recipe meals
  have null `name`. Written meals can be edited, moved, repeated and removed.
- Help with shopping starts a meal-scoped chat. The server reads the meal,
  eaters and existing shopping items. Chat can add requested shopping items
  directly to that meal without inventing a cookbook recipe. Suggestions and
  clarification belong in chat, not in a new structured shopping wizard.

## Consequences

Meal context does not require recipe context. Initial chat reads remain persisted
tool results following the first user message (ADR 14). The client waits for its
local meal edits to reach the server before starting that conversation. Moving
meals carries their shopping rows, including purchased state and manual changes.
Each meal has a `content_id` distinct from its deterministic slot id. Moves carry
it; repeating or replacing a meal creates a new one. Chats record the starting
content id, so shopping writes from an old conversation reject a replaced or
swapped slot. Shopping rows use random ids; the locked meal and name lookup make
chat additions retry-safe even after earlier items have moved to another slot.
