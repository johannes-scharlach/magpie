# Kitchen habits

Draft 2026-10-28. Step 2 of recipe organisation, after Tags (ADR 36).

## Problem Statement

Magpie plans meals without knowing how this kitchen usually eats. A
household has habits: pizza on Mondays, mostly the dishes they always
make, now and then something new. The planner can't follow any of them.
It has no rules for this, and it can't see what the household cooked
before. Its cookbook search returns the ten newest matches, so the
household's standards stay hidden behind whatever was imported last.

## Solution

The household sets its Kitchen habits, and the planner follows them:

- **Day habits**: a weekday and a kind of dish or cuisine, e.g.
  "Monday → pizza".
- **Known vs. new**: how much the plan reuses dishes the household
  already cooks.

The habits are asked during onboarding and can be edited in the household
profile. Both are small choices, not a text box. A habit's word becomes
one of the household's Tags, so recipes imported later carry that word.
A habit with no matching recipe still works: the planner suggests new
ideas of that kind.

The planner also gets the facts it needs to apply the habits: how often
and how recently each recipe was planned, an overview of the cookbook's
tags and cuisines with counts, and a search that puts the kitchen's
standards first.

## User Stories

1. As a new user, I want to say during onboarding that Monday is pizza
   night, so that Magpie plans pizza on Mondays from the first week.
2. As a new user with an empty cookbook, I want to pick a day habit from
   a starter list of dish kinds, so that I don't have to type or invent
   words.
3. As a new user, I want the cuisines I just picked to show in the day
   habit picker, so that "Wednesday → Italian" is two taps.
4. As a new user, I want to say how much the plan reuses dishes we
   already cook, so that Magpie knows whether I want my standards or
   something new.
5. As a new user, I want each habit question to say what Magpie will do
   with my answer, so that I understand what Magpie can do for me.
6. As a new user, I want to skip the habit questions, so that setup
   doesn't feel like work.
7. As a user, I want to change my habits later in the household profile,
   so that a habit I've outgrown stops shaping my plans.
8. As a user with a cookbook, I want the day habit picker to show my own
   tags and cuisines with how many recipes have each, so that I pick
   from what I actually cook.
9. As a user with a cookbook, I want the starter list to show after my
   own tags, so that I can still set a habit for something I don't
   cook yet.
10. As a user with a pizza habit, I want the pizzas I import later to be
    tagged with the same word, so that the habit finds them.
11. As a user with a pizza habit and no pizza recipes, I want the planner
    to suggest new pizza ideas for Monday, so that the habit works before
    my cookbook does.
12. As a user with many pizza recipes, I want the planner to choose a
    pizza I make often, so that Monday tastes like our Monday.
13. As a user who wants mostly known dishes, I want the planner to pick
    mostly recipes we have planned before, so that the plan matches how
    we eat.
14. As a user who wants new dishes now and then, I want the planner to
    mix one new dish into a mostly familiar week, so that we try things
    without the week becoming work.
15. As a user who wants mostly new dishes, I want the planner to lean on
    recipes we haven't planned yet or new ideas, so that cooking stays
    interesting.
16. As a user, I want the planner to avoid repeating what we had last
    week, so that the plan doesn't feel stuck.
17. As a user, I want to override a habit in the chat ("not pizza this
    Monday"), so that a habit stays a habit and not a law.
18. As a user, I want habits to never override allergies, diets, shop
    rules or equipment, so that firm boundaries stay firm.
19. As a user, I want the planner to tell me when a habit and my request
    conflict, so that I decide and it doesn't silently drop one.
20. As a user in a shared household, I want habits to belong to the
    household, so that everyone planning sees the same habits.
21. As a user, I want the planner to find our standard version of a dish
    first, so that it doesn't suggest a variant we tried once.
22. As a user, I want the planner to see how often each version of a
    dish was planned, so that it can tell "we make lasagne a lot" apart
    from "we always make the vegan lasagne".
23. As a user with a large cookbook, I want the planner to look through
    more than ten recipes when it needs to, so that it doesn't keep
    choosing from the same few.

## Implementation Decisions

### Kitchen habits in the household profile

- Habits are part of the household profile, next to the cooking goals,
  and validated by the profile schema in the shared profile package.
- A day habit is a weekday and one word: a catalog cuisine id, or a
  tag. Collections become pickable when they exist (step 3).
- Known vs. new is a single choice from a fixed set of three, with
  draft labels "Mostly what we cook", "A new one now and then",
  "Mostly new". The copy is final at implementation.
- Both are optional. No habit means no rule, not a default rule.
- Profile changes follow the additive-only migration rule: no column is
  dropped or renamed.

### Onboarding

- Two questions, after the cuisine question: day habits, then known vs.
  new. They use the existing choice tiles and draft recovery.
- The day habit picker offers a fixed starter list of dish kinds (pizza,
  pasta, curry, soup, stir-fry, salad, bake, tacos, fish, …) and the
  cuisines picked earlier.
- Each question states its consequence, e.g. "Magpie plans pizza on
  Mondays."

### Household profile screen

- Same picker. Order: the household's tags and cuisines with recipe
  counts, then the starter list.

### Habits reach the planner

- The profile context gains a "Kitchen habits" section next to the
  cooking goals. It states that habits are soft: the current request
  overrides them; allergies, diets, shop rules and equipment always
  apply; conflicts are shown, not silently resolved.
- Known vs. new is stated in terms the planner can check against
  `timesPlanned`.
- A day habit with no matching recipe tells the planner to suggest new
  ideas of that kind.

### Habit words become Tags

- `readTagVocabulary` includes day habit words that aren't catalog
  cuisines. Imports, chat saves and recipe writing already read the
  household's words from there, so they all reuse the habit's spelling.
- The re-tag script builds its starting vocabulary from the profile
  alone, so it adds day habit words too.

### Planner tools

- **Cooking history**: past PlannedMeals count as planned. Only dates
  before today count; upcoming meals come from `readPlan`.
- **`searchSavedRecipes`**:
  - Each result is a Variant with `lastPlanned` and `timesPlanned` for
    itself and for its Recipe.
  - Sort: Recipe `timesPlanned` desc, then `importedAt` (when the
    Variant entered the cookbook) desc, then id asc. No sort setting.
  - The agent sets `limit` (default 10, max 100) and `offset`.
  - An empty query lists the whole cookbook in the same order.
- **Cookbook overview** (new tool): the household's cuisines and tags,
  each with its number of Recipes. Its description tells the agent to
  read it before searching. Collections join it in step 3.
- **`readPlan`**: an optional `days` argument, so the agent can look
  back further than 14 days by passing a past `fromDate`.

## Testing Decisions

A good test checks what the planner or the household gets, through the
same entry point production uses. It doesn't check query shape or
internal helpers.

- **Profile context** (prior art: profile-context tests). Saved habits
  and known vs. new reach the prompt as soft rules. An empty habit list
  adds nothing. Invalid habit data doesn't break the profile.
- **Tag vocabulary** (prior art: the variants test with
  connection-private temp tables on the local database). A profile with
  "Monday → pizza" and an empty cookbook offers "pizza"; a habit naming
  a catalog cuisine adds no own cuisine.
- **Chat tools against the local database** (prior art: chat-tools and
  plan tests). Search returns history for Variant and Recipe, counts
  only past dates, sorts by Recipe `timesPlanned`, honours limit and
  offset. The overview counts Recipes per tag and cuisine. `readPlan`
  looks back.
- **Onboarding draft** (prior art: onboarding draft tests). Habit
  answers survive draft recovery and save to the profile; a skipped
  question saves no habit.

## Out of Scope

- Collections (step 3). Habits name tags and cuisines only for now.
- Correcting a Recipe's tags by hand.
- Showing cooking history or reordering the cookbook screen.
- Marking a planned meal as skipped. Past plans count as planned.
- Habits beyond day habits and known vs. new (e.g. per meal slot,
  per person, seasonal).
- Putting the whole cookbook into the prompt.

## Further Notes

- Open: does a day habit apply to dinner only, or to whichever meal is
  planned that day? Can a weekday have more than one habit?
- Open: the starter list's language. Tags are in the household's
  language, so the starter list needs the same.
- Naming: "Kitchen habit" goes into the glossary at implementation.
