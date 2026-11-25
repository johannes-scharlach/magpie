# Use what I have: plan-aware ingredient tiles

## Promise

From Meals → Lunch → Use what I have, I can ask for lunch using a few things in my kitchen without typing. If I plan lunch three days ahead, Magpie considers what will be available **then** and what I have already earmarked for another meal.

## Picking ingredients

Open the existing slot chat with a vertically scrollable grid of pantry-style ingredient art. Open the keyboard when the cook taps the search field, and keep the first row usable while typing. Mark selected items with a clay pebble and keep the selection beside the composer. Order the grid by:

1. **Use up first** — up to four likely, useful remainders. Omit the section if none qualify.
2. **Quick picks** — up to three fresh picks and three meal bases. Prefer the household’s usual picks. Display them alphabetically.
3. **More ingredients** — remaining ingredients the household keeps, in alphabetical order.

Show an ingredient once in the grid, at its highest priority. Ask what the cook wants to cook with above the grid. Typing replaces the sections with one alphabetical list of matches. A tap selects, a second tap deselects. Tap a match or use **Add** to include a typed ingredient that isn't shown; either action clears the field and keeps the selection editable. With the field empty, **Find ideas with these ingredients** asks Magpie for ideas featuring the selected ingredients in this slot. Meal ideas can also use other ingredients. Adding or selecting never sends, modifies the shopping list or records inventory.

## What Jev decides

Use the household meal plan alone, independent of shopping-list use. Evaluate relative to the target **date and slot**, not the day the picker opens. Assume past planned meals were normally cooked; assume future plans before the target will be cooked by then. Follow moved meals at their new slots and ignore skipped ones. Use actual variant quantities and selected alternatives; a meal without ingredient evidence cannot establish a quantity.

Compare likely package or whole-produce sizes with amounts used across earlier meals. Recipe wording is usage evidence, not a purchase measurement. Protect amounts needed by already-planned later meals within the ingredient’s plausible usable life. A later meal can claim some of a remainder but cannot create it earlier. Rank what is plausibly **both free to use and worth using soon**, considering perishability and elapsed time. Do not show estimated grams or ask users to confirm whether a meal was cooked.

**Acceptance story:** On Monday I plan Friday lunch. Wednesday uses “1 small head of cabbage (400 g).” A head might weigh 1.2 kg; cabbage is plausible without any purchase record. If Friday dinner needs all the likely remainder, omit it. If dinner only needs a few leaves, lunch may still get the tile. Moving Wednesday’s meal to Saturday removes it as a source. Dry pasta usually belongs under Staples even when half the packet remains.

Refresh target-specific results when relevant meals on either side change or the result ages out. Never hold opening, focus, selection or Send on Jev. Without a usable result, show staples and cupboard.

The assessment reads seven calendar days on each side of the target, plus the other slots on the target date (Lunch → Dinner → Treat). The window covers likely short-lived remainders and near-term reservations without treating the plan as an inventory ledger. Reservations outside it are not assessed. The app sends the resolved ingredient lines and quantities from its local plan so pending sync uploads do not delay refresh. It does not send List items, recipe instructions, or household identifiers. A successful result is reused in memory for up to 15 minutes only for the same household, target and plan evidence.

## Shopping and artwork

Use the same ingredient picture in Meals and Shopping. Shopping uses a checklist grouped by aisle, with aligned checkboxes, names and quantities, and artwork for recognition. Tap to check off, or tap a purchased item to restore. Open item details for meal context and substitutions. The picture follows the selected substitution. Both surfaces work for custom items and before art arrives.

**Add items** opens as a page sheet with a heading-free list of frequent purchases and household staples. Use shopping history first when choosing suggestions and display the resulting rows in alphabetical order. Typing filters the suggestions. Suggestions exclude items already on the list. Tapping a suggestion or adding typed text saves immediately and keeps entry ready for the next item. Items added in this session appear at the top with editable details. Submitting an exact name already on the list opens its details instead of adding it again. Done closes the sheet.

Resolve bundled onboarding art and known aliases first. A shared picture does not change a household’s label or merge shopping items. For unresolved labels, Jev can suggest cross-language reuse: eggplant and aubergine can share a picture; tomato paste and canned tomatoes should not. Accept only clear matches, otherwise leave unresolved. Generate from ingredient names, not household notes.

Batch unresolved ingredients into sprite sheets using the checked-in [ingredient art direction](../../apps/mobile/src/features/onboarding/art/README.md#4×4-ingredient-sprite-sheets-production-pipeline). Crop by assigned cell, use the existing background-removal pipeline, and publish individual transparent images. Start with a manually runnable backfill. A daily scan is a candidate cadence; decide from distinct misses, sheet yield and wait time.

## Delivery

Validate that the picker helps cooks use up ingredients both today and at future meals, including fresh produce, herbs and partial packs of meat. Verify the keyboard-open picker on a small phone and Shopping with a realistic grocery list. Art generation is independent of releasing either surface. This feature does not maintain pantry stock, infer purchases, or reserve quantities as database inventory.
