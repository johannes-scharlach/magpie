# 41. The shopping review keeps the recipe's order

Date: 2026-11-18
Status: Accepted
Amends: 16 (intentional meal shopping), 23 (explicit ingredient decisions)

## Context

ADR 16 introduced `shopping_hint`, an AI suggestion for which ingredients a
household probably has. ADR 23 reduced its role to ordering the shopping
review: likely purchases first, ingredients probably at home last. The hint
never decided anything. Explicit decisions already say what is to buy and what
is at home, and a guess about someone else's cupboard does not deserve a field
in every recipe.

## Decision

- Ingredient lines no longer carry `shopping_hint`. It leaves the recipe
  schema, the import instructions, the addToCookbook description, the mobile
  validation and the shared `IngredientLine` type.
- The shopping review lists ingredients in the recipe's order. Rows are not
  sorted by a guessed at-home status.
- Stored variants may still contain the key. Parsing drops it, and a rewritten
  recipe writes lines without it. No migration.
- Decisions, at-home marks and the review marker are unchanged.

## Consequences

The prompts lose a required field and the review has one fewer source of
truth. An ingredient's position no longer hints at whether the household
needs it; the cook decides.
