# 36. Magpie tags recipes in the household's words

Date: 2026-10-28
Status: Accepted
Builds on: 35 (imports find many recipes)

## Context

Imports bring whole cookbooks, and the cookbook needs to be organized to stay
useful. Organizing has two owners. Tags belong to Magpie: they help find
similar dishes and let planning rules work, and nobody should have to curate
them. Collections, which come later, belong to the cook.

Each import used to fill two free-text fields. The model picked a new word
each time, so one dish came out as "German", "Austro-German" or "Austrian".
The category said "Dinner" or "Lunch", which says nothing about the dish.

## Decision

What a dish is belongs to the recipe; how one version is made belongs to the
variant. Whoever writes the recipe (import, chat, meal adjust) supplies all
four, and the first variant sets the recipe's two:

- **Cuisine** (recipe): a catalog id from the profile, else the household's
  own cuisine word, else a new short name. A regional style takes its
  cuisine's id. The app shows it with `cuisineLabel`, as in the profile.
- **Tags** (recipe): one or two words for the kind of dish, in the recipe's
  language: "pasta", or "pasta" and "bake". They name what the dish is, never
  what it resembles: Flammkuchen is "flatbread". Treating it as pizza is the
  cook's call, not Magpie's.
- **Equipment** (variant): the appliances this version needs, from the
  profile's equipment ids or the household's own words ("sous vide").
  Planning can check it against what the household has.
- **Effort** (variant): no-cooking, easy, normal, more-work or big-project,
  judged by the dish's work and cleanup, not by how finely the recipe is
  written or by the total time. Each level has examples in the schema;
  pasta with tomato sauce is easy.

The household's existing words are in the prompt, and saving maps a word
that differs only in case onto the household's spelling or the catalog id.

A variant is the same dish. Saving one in a different cuisine from its
recipe is refused, and the chat is told to save a new recipe instead. The
chat prompt adds the part code cannot check: a different kind of dish is a
new recipe too, while a vegan, quicker or air-fryer version is a variant.
Meal adjust keeps the recipe's cuisine as it is.

The tags migration only adds columns. Nothing writes `recipe_category` or
`variants.recipe_cuisine` anymore; they stay until no installed app uploads
them, so no app release has to go with the migration. Search matches the
recipe's tags and its cuisine's name. The cookbook row shows cuisine, effort
and time; the yield is settled when a meal is planned.

`pnpm --filter api retag` tags saved recipes again, oldest first, one call
per recipe with all its variants, so a household's words settle the way new
imports will use them. It shows each household's result and saves exactly
that once the operator confirms.

## Consequences

- The cook cannot correct a tag yet.
- A recipe copied from another household keeps that household's tags.
- Planning rules (next) can name a cuisine, a tag, equipment or an effort.
