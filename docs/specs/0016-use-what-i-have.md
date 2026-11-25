# Use what I have: plan-aware ingredient tiles

## Promise

From Meals → Lunch → Use what I have, I can ask for lunch using a few things in my kitchen without typing. Nearby planned meals suggest perishable ingredients I may already have or can buy and use across meals.

## Picking ingredients

Open the existing slot chat with a vertically scrollable grid of pantry-style ingredient art. Open the keyboard when the cook taps the search field, and keep the first row usable while typing. Mark selected items with a clay pebble and keep the selection beside the composer. Show up to six ranked meal-plan ingredients under **From your meal plan**. **Show more** continues the same grid with the remaining qualifying results. Put household ingredients under **More ingredients**, alphabetized by their displayed names.

Show an ingredient once in the grid, at its highest priority. Ask what the cook wants to cook with above the grid. Typing replaces the sections with one alphabetical list of matches. A tap selects, a second tap deselects. Tap a match or use **Add** to include a typed ingredient that isn't shown; either action clears the field and keeps the selection editable. With the field empty, **Find ideas with these ingredients** asks Magpie for ideas featuring the selected ingredients in this slot. Meal ideas can also use other ingredients. Adding or selecting never sends, modifies the shopping list or records inventory.

## What Jev decides

Use the household meal plan alone, independent of shopping-list use or at-home marks. Meals before and after the target are equally valid evidence of ingredients the cook might have or buy. Follow moved meals at their new slots and ignore skipped ingredients. Use recipe quantities and selected alternatives.

For each ingredient, Jev classifies storage needs in the recipe’s language and separately judges the chance of a usable remainder, how soon it will lose quality, and the relative cost of wasting it. A remainder needs at least a 0.4 probability and an urgency score of at least 1.1 on the 0–3 scale. Exclude ingredients classified as shelf-stable or long-keeping. Treat whole retail packs and produce bought as whole loose units as evidence against a remainder. A recipe using half a whole item can leave a useful remainder. Rank eligible ingredients by urgency, boosted by up to 100% for valuable remainders. Use remainder probability to break ties.

Refresh target-specific results when relevant meals on either side change or the result ages out. Never hold opening, focus, selection or Send on Jev. While suggestions load, show placeholders in the grid and list while search and the current selection remain usable. If the wait reaches five seconds, show the alphabetical ingredient list. Offer **Show meal plan suggestions** when a late result arrives. Reuse a cached result on the next visit when the evidence still matches.

The assessment reads seven calendar days on each side of the target, plus the other slots on the target date. The window keeps the evidence close to the meal being planned. The app sends the resolved ingredient lines and quantities from its local plan so pending sync uploads do not delay refresh. It does not send List items, recipe instructions, or household identifiers. A successful result is reused in memory for up to 15 minutes only for the same household, target and plan evidence.

## Shopping and artwork

Use the same ingredient picture in Meals and Shopping. Shopping uses a checklist grouped by aisle, with aligned checkboxes, names and quantities, and artwork for recognition. Tap to check off, or tap a purchased item to restore. Open item details for meal context and substitutions. The picture follows the selected substitution. Both surfaces work for custom items and before art arrives.

**Add items** opens as a page sheet with a heading-free list of frequent purchases and household staples. Use shopping history first when choosing suggestions and display the resulting rows in alphabetical order. Typing filters the suggestions. Suggestions exclude items already on the list. Tapping a suggestion or adding typed text saves immediately and keeps entry ready for the next item. Items added in this session appear at the top with editable details. Submitting an exact name already on the list opens its details instead of adding it again. Done closes the sheet.

Resolve bundled onboarding art and known aliases first. A shared picture does not change a household’s label or merge shopping items. For unresolved labels, Jev can suggest cross-language reuse: eggplant and aubergine can share a picture; tomato paste and canned tomatoes should not. Accept only clear matches, otherwise leave unresolved. Generate from ingredient names, not household notes.

Batch unresolved ingredients into sprite sheets using the checked-in [ingredient art direction](../../apps/mobile/src/features/onboarding/art/README.md#4×4-ingredient-sprite-sheets-production-pipeline). Crop by assigned cell, use the existing background-removal pipeline, and publish individual transparent images. Start with a manually runnable backfill. A daily scan is a candidate cadence; decide from distinct misses, sheet yield and wait time.

## Delivery

Validate that the picker helps cooks use up ingredients both today and at future meals, including fresh produce, herbs and partial packs of meat. Verify the keyboard-open picker on a small phone and Shopping with a realistic grocery list. Art generation is independent of releasing either surface. This feature does not maintain pantry stock, infer purchases, or reserve quantities as database inventory.
