# Magpie

Meal planning and shopping in one place — plan meals, derive the List, cook from variants.

## Language

### Product

**Control**:
The user decides how they eat, their decisions are put into practice, and neither the choices nor the work become overwhelming.

### Cooking

**Recipe**:
A named dish as grandma wrote it — the title in the book (e.g. "Chicken Traybake").
_Avoid_: Dish, meal

**Variant**:
A complete, cookable form of a Recipe with its own ingredients, quantities and instructions. Variants are alternative ways to make the Recipe; a newer Variant does not supersede the others.
_Avoid_: Version, fork

**IngredientLine**:
One row in a Variant — `qty_text` + `item_name` + optional `prep_note` (e.g. item "roasted peppers", qty "1 jar", prep "drained" — rendered as "1 jar roasted peppers, drained" in the recipe, projected as "1 jar roasted peppers" on the List).
_Avoid_: Ingredient, item

**Tag**:
A short word Magpie gives a Recipe for the kind of dish it is ("pasta", "bake", "flatbread"), in the household's language. It names what the dish is, never what it resembles. Magpie owns tags and reuses the household's existing ones. A Recipe also has a cuisine; a Variant has its equipment and Effort.
_Avoid_: Category, label

**Effort**:
How much a Variant asks of the cook, on a fixed scale: No cooking, Easy, Normal, More work, Big project. Judged by the work, not the total time.
_Avoid_: Difficulty, time

**PlannedMeal**:
A Recipe + chosen Variant placed on a calendar slot (day/meal) with servings.
_Avoid_: Meal plan entry, scheduled recipe

### Household

**Staple**:
An ingredient the household keeps at home, ticked from the staple groups. The app calls them "Usual ingredients"; code and prompts call them staples.

### Shopping

**ShopRule**:
The household's instruction for how Magpie should use a shop: as an everyday source, for optional upgrades, or only when a trip is worthwhile. It is a choice about meal planning and ingredients, not a rating of travel effort or shop type.

**List**:
The single checkable list for a household — groceries, meal-derived items and non-food together. Checked at home ("do I have this?") and at the shop ("did I buy this?").
_Avoid_: Shopping list, home list, groceries list, shop list

**ListItem**:
One checkable row in the List. Either `standalone` (manually added, e.g. "lemons") or `meal-derived` (projected from a PlannedMeal's Variant).
_Avoid_: Entry, product

**Swap**:
Choosing a different Variant for a PlannedMeal.
_Avoid_: Substitution, replacement

**SwapSuggestion**:
A stored 1:1 alternative for an IngredientLine (e.g. "bell pepper → jarred roasted peppers"), generated when a Recipe is imported. Not a Variant until chosen.
_Avoid_: Alternative

### Household activity

**HouseholdActivity**:
A fact about something that happened in the household, such as a person joining.
It remains true regardless of whether anyone has seen it or received a notification.
_Avoid_: Notification

**ActivityRecipient**:
A household member an activity is addressed to. Each recipient has their own seen state.

**Seen**:
An activity has been visibly presented to a recipient or opened by them. This is
an observation, not proof of reading or acknowledgement.
_Avoid_: Read, acknowledged

### Conversations

**ChatTurn**:
One user message and the assistant's work in response. Completed actions remain
part of the turn even if the assistant cannot finish its reply.

**ChatReply**:
The assistant's response to a ChatTurn. A partial ChatReply is not a completed
turn, and losing its live delivery does not mean the turn failed.
