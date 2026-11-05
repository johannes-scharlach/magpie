# Kitchen habits

Revised 2026-11-05. Step 2 of recipe organisation, after Tags (ADR 36).

## Current authoring: a brief for meal ideas

This replaces the day-habit authoring described in the original design below.
The structured day habits are now legacy data; the cookbook tools and familiar-
versus-new preference still apply. Usual meals-at-home remains a separate
attendance default, not the scope of meal suggestions.

The question is “Which meals would you usually like ideas for?” Always show the lunch
and dinner grid, Monday–Sunday, with a quiet “Tap or swipe” hint and no quick
selects. Touch-down previews a cell; dragging paints the row, while scrolling
cancels the preview. Taps and swipes apply directly, without a separate
confirmation. No meals or habits are selected for a new household.

The optional text field holds only the household's own guidance. The grid's
generated coverage sentence is not shown there; it reaches the agent alongside
the notes. Changing either answer preserves the other.

On the same screen, “What would make those ideas work for you?” starts with
Familiar favourites, One new dish a week, and New discoveries. Selecting one replaces
the choices with a single editable, complete answer, with examples beneath it.
There is no empty text box alongside the choices and no separate favourites
step. Continue needs no further writing. Clear removes the guidance and returns
to the three choices without changing the grid. Existing notes and favourites
appear together in that one field; edits replace both, not just one hidden rule.
Drafts saved on the removed favourites step resume at this combined question.
The middle choice prefills “Mostly our favourites, with about one new dish a
week.” Its concrete frequency survives the transition into the editable answer.

Concrete sentences beside the field show what people can write:

- “We want rice and stuff at least twice a week.”
- “We could eat pasta twice a week.”
- “Some nights we have bread, cheese and a few other things for dinner.”
- “We cook enough dinner for lunch the next day.”

These are examples, not buttons or rules added to the answer. The household's
words guide suggestions, not a preset inferred from them. Meal coverage comes
from the visible grid; the earlier household question does not ask for it again.

Proposals should be easy for that household: familiar cooking, assembled meals
and pickup all count. Available time does not invite Magpie to assign a cooking
project. Preserve a minimum, a preference and an acceptable option as different
intentions. Requested leftovers connect dinner quantities to tomorrow’s lunch.
The household commits to meals; the brief and proposals are not approval to
write a plan.

### Storage and existing answers

`meal_ideas_brief` is the single saved answer: generated meal coverage followed
by the household's editable guidance. `meals_at_home` continues to describe
usual attendance. The brief is replicated through the normal profile stream.
Onboarding and household settings use the same combined editor; summaries and
both suggestion paths read the same effective brief.

`day_habits` and `new_dishes` are read-only compatibility fields. Existing
structured habits, preset favourites and custom favourites wording are included
when reading an older profile, without rewriting it in the background. Editing
the brief, completing onboarding or copying a profile to a new household saves
the complete brief with `day_habits: []` and SQL `new_dishes: null` in the same
write. Clear removes only the guidance and retains coverage; cleared legacy
answers cannot reappear after save/reload. Historical tags remain readable;
prose is not automatically converted into recipe Tags. The legacy columns are
not dropped by this change.

Tests cover chosen slots becoming a sentence, legacy habits retaining their
meaning, custom writing surviving recovery/save/upload, and the brief reaching
both suggestion contexts with the user-commitment boundary.

## Original structured-habit design (historical)

## Problem Statement

Magpie plans meals without knowing how this kitchen usually eats. A
household has habits: pizza on Mondays, mostly the dishes they always
make, now and then something new. The planner can't follow any of them.
It has no rules for this, and it can't see what the household cooked
before. Its cookbook search returns the ten newest matches, so the
household's standards stay hidden behind whatever was imported last.

## Solution

The household sets its Kitchen habits, and the planner follows them:

- **Day habits**: when, a meal and what, read as one sentence:
  - On **Mondays** we usually have **pizza** for **dinner**.
  - **Twice a week** we usually have **pasta** for **lunch**.
  - **3 times a week** we usually have **Thai or Japanese** for
    **dinner**.
  - On **Fridays** we usually have **no meat** for **lunch and dinner**.
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

1. As a new user, I want to say during onboarding that Monday dinner is
   pizza, so that Magpie plans pizza on Mondays from the first week.
2. As a new user with an empty cookbook, I want to pick a day habit from
   a starter list of dish kinds, so that I don't have to type or invent
   words.
3. As a new user, I want the cuisines I just picked to show in the day
   habit picker, so that "Wed · dinner → Italian" is a few taps.
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
23. As a user, I want one habit to cover several days ("Weekdays ·
    lunch → salad"), so that I don't set the same habit five times.
24. As a user, I want two habits that meet on one meal to both count
    ("Fri · dinner → fish" and "Weekdays · dinner → Italian"), so that
    Friday gets an Italian fish dish, or I'm told why it can't.
25. As a user with a large cookbook, I want the planner to look through
    more than ten recipes when it needs to, so that it doesn't keep
    choosing from the same few.
26. As a user, I want to say "pasta twice a week" without picking days,
    so that the habit matches how we actually eat.
27. As a user, I want one habit to name several cuisines ("Thai or
    Japanese"), so that I don't have to split one habit into two.
28. As a user, I want to use my own word for a habit ("no meat"), so
    that a habit isn't limited to the starter list.
29. As a user, I want to tell "pasta for lunch or dinner" apart from
    "pasta for lunch and dinner", so that Magpie plans one pasta or two.

## Implementation Decisions

### Kitchen habits in the household profile

- Habits are part of the household profile, next to the cooking goals,
  and validated by the profile schema in the shared profile package.
- A day habit is a rule with three parts:
  - **When**: a set of weekdays, or a number of times a week (1–7). A
    number counts meals and leaves the days to the planner.
  - **Meal**: lunch, dinner, "lunch or dinner" (one of the two counts)
    or "lunch and dinner" (each counts). With a number of times a week,
    "lunch and dinner" isn't offered: "twice a week for lunch or dinner"
    means two meals. The treat is not a habit
    meal; saved treat habits are dropped.
  - **What**: optional. One or more words, each a catalog cuisine id or
    a tag, meaning any of them ("Thai or Japanese"). Without a word,
    the habit only says that meal is cooked. There is no "not": it
    invites rules like "3 times a week no pizza". A household that wants
    "no meat on Fridays" picks its own word "no meat", which becomes a
    tag like any other. Collections become pickable when they exist (step 3).
- Habits saved before this keep working: a single word reads as a list
  of one.
- The day picker offers "Every day", "Weekdays" and "Weekend" as
  shortcuts next to single days.
- The sheet builds the habit as a sentence ("On Mondays we usually have
  pizza for dinner."). The setup question is "What repeats in your
  kitchen?" and lists one clay card per habit rather than calendar slots
  to fill. A card names the optional dish, when it repeats and its meal.
  Keeping "something" in the sentence creates a cadence-only habit: without
  a dish, the habit says the meal is cooked. Empty days impose no rule.
- A household can have any number of day habits. Habits that meet on the
  same meal all apply; the planner tries to satisfy them together and
  says so when it can't.
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
- Habits that meet on the same meal are stated as applying together.
- Each habit is one line the planner can't misread: "lunch or dinner"
  means one of the two, "lunch and dinner" means each, a number of times
  a week counts meals on any days.

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
  and known vs. new reach the prompt as soft rules, each naming its days
  and meal. An empty habit list
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
- Habits beyond day habits and known vs. new (e.g. per person,
  seasonal).
- Effort as a habit's word. The cooking goal "Keep weeknights quick"
  already covers it.
- Putting the whole cookbook into the prompt.

## Further Notes

- The starter list is English for now, like the app. The household's
  own words come first in the picker.
- Cooking goals and habits overlap ("Try new cuisines" and known vs.
  new). Keep both for now; see which survives use.
- Naming: "Kitchen habit" goes into the glossary at implementation.
