# Collections

Draft 2026-10-29. Step 3 of recipe organisation, after Tags (ADR 36) and
Kitchen habits (spec 0014).

## Problem Statement

A cookbook of a few hundred recipes is hard to use as one list. The cook
thinks in groups they made themselves: the Ottolenghi book, weeknight
standards, the dishes the kids eat. Tags can't hold these groups. Tags
belong to Magpie and name the kind of dish, while these groups belong to
the cook and mean whatever the cook says they mean. Today Magpie has no
place for them, so the planner can't follow "Ottolenghi on Wednesdays",
and the cook can't browse them either.

## Solution

The household keeps Collections: named sets of recipes they curate.
Magpie helps fill them:

- When the cook makes a collection, or asks for more, Magpie suggests
  recipes from the cookbook. The cook picks which ones go in.
- A bulk import goes into one collection: an existing one, a new one
  named after the source, or none.

Collections show on the cookbook screen as tiles, not as list rows. Day
habits can name a collection, and the planner can see and search by
collection.

## User Stories

1. As a cook, I want to make a collection and name it myself, so that
   my cookbook is grouped the way I think about it.
2. As a cook, I want Magpie to suggest recipes for a new collection, so
   that I don't have to go through my whole cookbook to fill it.
3. As a cook, I want none of the suggestions picked for me, so that only
   what I choose goes into my collection.
4. As a cook, I want to add many suggestions in one go, so that picking
   twenty recipes stays quick.
5. As a cook, I want suggestions that understand what my collection's
   name means, so that "Weeknight standards" and "The kids eat this" get
   sensible picks, not only "Italian".
6. As a cook, I want suggestions to take the recipes already in the
   collection into account, so that Magpie picks more of the same kind.
7. As a cook, I want to ask for more suggestions for an existing
   collection, so that new recipes find their way in.
8. As a cook, I want suggestions to leave out recipes already in the
   collection, so that I only see new candidates.
9. As a cook, I want to add a recipe to a collection from the recipe's
   screen, so that I can file it while I'm looking at it.
10. As a cook, I want a recipe to be in several collections, so that my
    lasagne can be both "Weeknight standards" and "The kids eat this".
11. As a cook, I want to remove a recipe from a collection, so that the
    collection stays what I mean by it.
12. As a cook, I want to rename a collection, so that its name keeps up
    with how I use it.
13. As a cook, I want to delete a collection without losing its recipes,
    so that tidying up never costs me recipes.
14. As a cook importing photos of a cookbook, I want the whole batch to
    go into one collection, so that the book stays together.
15. As a cook importing a cookbook, I want Magpie to suggest a new
    collection named after the source, so that "Ottolenghi Simple" is
    one tap.
16. As a cook, I want Magpie to suggest an existing collection for an
    import when it fits, so that more recipes from the same book join
    the ones I already have.
17. As a cook, I want to import without a collection, so that a batch
    of unrelated recipes doesn't force a grouping on me.
18. As a cook, I want my collections at the top of the cookbook as
    tiles, so that they feel like places to go and not like list items.
19. As a cook, I want a collection to show its recipes most-cooked
    first, so that its standards are on top.
20. As a cook, I want to set a day habit to a collection ("Wednesday →
    Ottolenghi"), so that Magpie plans from it on that day.
21. As a cook, I want the planner to know my collections and how big
    they are, so that it can plan from them when I ask.
22. As a cook, I want the planner to search within a collection, so
    that "something from Ottolenghi" finds Ottolenghi.
23. As a member of a shared household, I want collections to belong to
    the household, so that everyone sees and edits the same ones.
24. As a cook without signal, I want to make and edit collections
    offline, so that it works like the rest of the cookbook.

## Implementation Decisions

### Collections

- A Collection belongs to a household (list) and has a name. It holds
  Recipes, not Variants. A Recipe can be in any number of Collections.
- Two new synced tables: collections, and the recipes in each
  collection. Both carry the list id for sync rules and RLS. The
  migration only adds; nothing is dropped or renamed.
- Adding, removing, renaming and deleting happen on the device and sync
  like the rest of the cookbook. Deleting a collection removes its
  membership rows, never the Recipes. Deleting a Recipe removes it from
  its Collections.
- Inside a collection, recipes sort the same way as the planner's search:
  Recipe `timesPlanned` desc, then when it entered the cookbook desc,
  then id.

### Suggestions

- Suggestions run in the API, which makes the model calls.
- Each Recipe goes to the model as one short line: name · cuisine · tags
  · effort · `timesPlanned`.
- **Filling a collection**: the model gets the collection's name, the
  recipes already in it, and the rest of the household's cookbook, and
  returns the recipes that fit. The API returns only Recipes of this
  household that aren't in the collection yet.
- **Bulk import**: the model gets the batch's recipe names and source
  plus the household's collection names, and returns one existing
  collection or a new name, or none.
- The cook decides every addition. Nothing is added without a tap.
- How suggestions show (list, chips, other) is decided at design. The
  starting point is a list with nothing ticked and one button to add the
  ticked ones.

### Bulk import

- The review sheet gets one choice for the whole batch: the suggested
  collection (existing or new), another collection, or none.
- Confirming the import puts the confirmed recipes into that collection,
  creating it if it is new, in the same transaction as the recipes.
- Splitting one batch across collections is out.

### Cookbook screen

- Collections show above the recipe list as tiles in the clay look, not
  as list rows. The layout (a scrolling row, a grid, or something else)
  is decided at design.
- Tapping a tile opens the collection's recipes.

### Planner

- The cookbook overview tool (spec 0014) lists collections with their
  number of Recipes.
- `searchSavedRecipes` takes an optional collection to search within.
- Day habits (spec 0014) can name a collection. The profile context
  names it so the planner can search it.

## Testing Decisions

A good test checks what the cook or the planner gets, through the same
entry point production uses. It doesn't check prompt wording, query
shape or internal helpers.

- **Suggestions, with a stubbed model** (prior art: recipe-extraction
  tests). Only this household's Recipes come back, none already in the
  collection, and unknown ids from the model are dropped.
- **Import confirm** (prior art: import-operations tests against the
  local database). Confirmed recipes land in the chosen collection; a
  new collection is created once; no collection leaves recipes
  ungrouped; a discarded import adds nothing.
- **Chat tools against the local database** (prior art: chat-tools
  tests). The overview counts Recipes per collection; search within a
  collection returns only its Recipes.
- **Profile context** (prior art: profile-context tests). A day habit
  naming a collection reaches the planner with the collection's name.
- **Mobile collection edits** (prior art: recipe-copies and
  planned-meals tests). Add, remove, rename and delete change membership
  only; Recipes stay intact; a Recipe can be in several collections.

## Out of Scope

- Splitting one bulk import across several collections.
- Collections of Variants.

### Later

Not in this spec, but wanted:

- Sharing a collection or "my rotation" with friends.
- Correcting a Recipe's tags by hand.
- Suggesting a collection when a single recipe is saved from the chat or
  imported on its own.
- Ordering collections by hand.

## Further Notes

- Open: where the cook starts a new collection. Candidates are the
  cookbook screen next to the tiles, and "Add to collection" on a
  recipe. Decided at design.
- Open: how collection tiles look and scroll, and whether they get art.
- Naming: "Collection" goes into the glossary at implementation, next to
  Tag.
