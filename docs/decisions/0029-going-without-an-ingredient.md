# 29. Going without an ingredient is a swap to nothing

Date: 2026-10-20
Status: Accepted
Amends: 20 (meal-owned ingredient choices), 23 (explicit ingredient decisions)

## Context

Recipes have optional ingredients, and households leave out ones they
dislike. Neither had a representation, so the agent never offered either.
A separate "optional" flag would describe the recipe, but the useful fact is
the cook's choice, and swaps already say "the recipe gets rewritten when the
cook picks it".

## Decision

- An ingredient line may carry `without`: the cook-facing label for going
  without it, a few imperative words naming its role in this dish ("Skip the
  garnish", "Leave out the heat"). Its presence means the dish still cooks
  well without the line, after a rewrite if needed. Core ingredients never
  get one; that stays a conversation. Imports give it to lines the source
  calls optional.
- Going without is the line's last option (`@magpie/meals`
  `ingredientOptions`). The meal's choice points at it by index like any
  swap, so it is meal-owned, offline and carried by rebase while a rewrite
  keeps the line.
- Nothing is left to buy: choosing it removes the line's unbought row in the
  same write. Bought rows stay purchase facts.
- In the shopping review it is a fifth decision, "without", shown as
  Skipped. Choosing the ingredient again makes it undecided: the meal
  changed, so the shopping needs a new decision. Every meal choice write
  recomputes the review marker.
- It is drift like any other swap. Adjust removes the line and rebalances
  amounts and steps.
- On Shop it lives in the item sheet, not the swipe strip: a row cannot
  browse to having nothing to buy. An upcoming meal's item shows "I have it
  at home" instead of "Remove from list", so every way off the list is a
  decision the meal knows. Past meals and the user's own items keep "Remove
  from list".

## Consequences

Cook mode shows the variant as written, as it does for named swaps; the
choice reaches the steps through Adjust. Skipping a garnish also counts as a
swap not in the steps, though the steps rarely need to change.
