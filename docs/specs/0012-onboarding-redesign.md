# Onboarding: useful choices, native controls

Implemented 2026-10-13; remaining household/setup screens revised 2026-10-27.
This supersedes the presentation, restriction entry,
shopping entry, staple options/defaults, and portion model in spec 0003.
The separate hands-on first-run experience in spec 0011 remains out of scope.

## Direction: control over food

Onboarding establishes three things together: the user decides how they eat,
Magpie puts those decisions into practice, and neither the choices nor the work
become overwhelming. It is a briefing for Magpie, not merely a profile
questionnaire. For every answer, the user should understand: "Because I chose
this, Magpie will..." More settings and more questions are not more control.

Prefer useful information throughout setup. Empty states should invite an
answer, not encourage leaving it blank. That does not make every answer
mandatory. Show the effect through meaningful controls and the resulting list,
rather than repeating it in introductory paragraphs.

Keep firm boundaries, defaults, priorities and permission to explore distinct;
these are design distinctions, not terminology users need to learn. Do not force
every question into the shops' three-choice pattern. Cooking rules, shops and
the remaining household/setup questions use this approach:

- Cooking rules should guide decisions and have a cost: quicker meals, lower
  spending, more explanation or less multitasking. A benefit without a meaningful
  trade-off belongs in Magpie's defaults, not a checkbox.
- Diet should communicate behaviour, not depend on an identity label alone:
  e.g. put vegetables at the centre while still including meat and fish.
  Firm dietary exclusions remain firm.
- Cuisines should distinguish everyday suggestions from exploration. What
  someone already cooks is not automatically what they want more of; an
  unselected cuisine is not a prohibition.
- Staples invite Magpie to make good use of ingredients usually kept. They
  describe habits, not confirmed current inventory or a requirement to use
  those ingredients in every meal.
- Household and meal routine establish the usual eaters, portions and meals
  to plan for. These are useful defaults, not an inflexible schedule.
- Allergies and must-avoids stay firm boundaries; dislikes are not allergies.
  Equipment remains a fact about what cooking methods are available, not
  another set of preference controls.

## Experience

Use plain questions and concrete choices. Preserve the warm light palette and
clay artwork style. Large artwork belongs on welcome; equipment and ingredient
artwork belongs inside the choices. No decorative banners above busy questions,
generated response paragraphs, sparkles, or written summary at signup.

Clay artwork serves recognition first, makes setup feel less like filling in a
form second, and carries the visual identity third. Use a plainer representation
when it genuinely improves recognition, not merely to pack in more choices. Keep
clay large enough for its material quality to register; tiny clay icons are not
the compact alternative. Staples and cuisines use the same ingredient tiles,
artwork size, selection feedback and custom-entry interaction, so staples teach
the pattern used on the next screen.

The flow is name, cooking rules, food rule, people and meal routine, foods to
leave out, shops, equipment, measurements, usual ingredients, familiar cooking,
email and code.
Staples introduce ingredient selection in three open groups; cuisines then pair
each chosen cuisine with the ingredients kept for it. Household add/edit uses a native
form sheet on both platforms, including the creator's details.

- Goals: seven multi-select rows, each pairing a request with how Magpie will
  act on it. Custom entries remain possible; no preselection, ranking or extra
  configuration step.
- Diet: single-select instruction rows with their practical meaning visible
  before selection. A new person starts with no diet-based reduction or swaps;
  existing answers keep their saved meaning.
- Household: names, ages, diets, portion references, attendance, and normal meals.
- Avoidances: separate allergies/must-avoids from dislikes on one screen.
  Ingredient shortcuts open an editor, not a selected answer. Record the food,
  reason, people it applies to, and any forms/preparation/exceptions. Allergies
  can specify precautionary-label guidance without a severity scale. Save
  finishes one entry; Continue finishes the question. The empty list invites
  adding information, without encouraging people to skip it.
- Shops: one list of named sources, each with a user-chosen sourcing rule:
  everyday meals, optional upgrades, or only when a trip is worthwhile. The
  first arrival opens one form sheet over the question; Save returns to the list. Butcher,
  Asian supermarket, and Weekly market are secondary prompts for other sources.
  No separate main shop or compulsory retailer-type field.
- Equipment: illustrated two-column grid and custom equipment. Nothing starts
  selected for a new setup: availability is a fact, not a guessed preference.
  Saved equipment selections are unchanged.
- Usual ingredients: three open groups, Cupboard, Fridge and Freezer, using the
  same illustrated ingredient picker as cuisines. Cupboard includes tins and
  jars. Nothing preselected, no minimum, no separate expand/collapse task.
  These describe habits, not confirmed stock or ingredients required in every
  meal; Magpie handles that distinction without another question or paragraph.
- Familiar cooking: regional cuisine switch rows and the user's own cooking.
  Selecting a cuisine reveals its ingredient picker directly beneath it and
  leaves it visible while selected. These are starting points, not a whitelist
  or a request for more of every selected cuisine. Shared ingredients remain
  one selection across groups; Greek and plain yoghurt stay separate.
- Email: a small composition of the user's selected ingredient/equipment artwork.
  Six-digit email verification, returning-account handling, local drafts, and
  retry-safe finalization remain. No account request before explicit email submit.
  No artificial delay after verification; local persistence gates completion.

Artwork placeholders show exact human-readable IDs. The complete production
prompts and framing requirements are in
`apps/mobile/src/features/onboarding/art/README.md`. Images are supplied later.
Native navigation/selection symbols are not artwork requests.

## Persisted meaning

- `household_profiles.goals` keeps its JSON preset-booleans/`other` array shape.
  Existing keys adopt the clearer instructions described below. New goals are
  unselected; retired choices for cooking with what is available, balanced meals
  and using up purchases become custom entries.
- `household_people.portion_reference`: 0.25–2 regular adult helpings in 0.05
  steps, default 1. The creator and other people use the same editor. Recipe
  generation sums the selected people's references, then adds per-meal extra
  portions. Do not reduce an explicit reference again based on age.
- `household_profiles.ingredient_avoidances`: JSON array of
  `{ ingredient, kind: allergy | restriction | dislike, detail,
person_ids?, trace_policy? }`. The optional fields are described below.
- `household_profiles.shops`: JSON array of
  `{ name, rule: everyday | upgrade | worth-trip }`. Older `access` ratings
  remain readable but do not imply a sourcing rule. A new entry stays local to
  its editor until Save validates both name and rule. Continue on the list
  requires explicit rules for existing named shops. Blank or cancelled entries
  are not stored.
- Existing `restrictions` and `other_shops` strings remain readable/editable
  notes. No attempt to guess or parse their meaning into the new structured
  choices. The assistant receives both.
- The older pantry/fresh columns remain stored but are no longer asked or sent
  to the assistant. Current cuisine/ingredient answers use `cuisines`, `keeps`
  and `extras`; reading does not infer specific foods from old categories.
  All current ingredient answers are habits, not confirmed inventory.
- Shops guide sourcing, without claims about live stock or restrictions on
  cuisines. Everyday sources form the baseline. Upgrades stay optional; trips
  need a meaningful improvement and, in a multi-meal plan, should make use of
  those ingredients across meals where it makes sense. Optional sources never
  become required without the user's agreement.
- Section saves must only write supplied fields. Schema defaults must not reset
  another section during an edit.

Changing a person's reference affects subsequent recipe generation/adjustments;
it does not rewrite existing recipes or reinterpret extra portions. Existing
`sized_for` metadata still records eater IDs and extra portions, not historical
appetite snapshots (same boundary as existing diet/age edits).

## Measurements (2026-10-27)

After equipment, “Which measurements should Magpie use?” sets Measurements
(Metric / US customary), Temperature (°C / °F), and “Automatically convert
imported recipes”. The subtitle is “Magpie will use these units when writing
recipes.” The import switch explains “Use these units for new imports.
Existing recipes won’t change.” Do not explain teaspoons or tablespoons in
user-facing copy.

These are household-wide choices, also editable under Measurements in household
settings. `household_profiles.measurements` is a JSON object containing `system`
(`metric` / `us`), `temperature` (`celsius` / `fahrenheit`), and `convert_imports`
(boolean). Defaults are metric, Celsius, and conversion on. The two unit choices
are independent. Section saves must not reset another section or rewrite recipes.

Recipe writing, explicit recipe adjustments and follow-up suggestions use these
units instead of inferring them from timezone. Import reads the destination
household's saved choices and converts only when enabled, for links, text and
photos, with or without planning.
The prompt asks for normal cooking conventions rather than mechanical unit
replacement: retain teaspoons and tablespoons for convenient small amounts, use
sensible precision and do not invent uncertain conversions.

**Converted imports retain no separate source measurements.** Return only the
converted measurements, consistently throughout ingredients, instructions and
notes. Do not retain source measurements in parentheses, notes, extra fields or
a separate original variant. Normal source attribution remains; there is no
checking workflow or second measurement display.

Migration: `20261027110000_household_measurements.sql`, with the client schema,
JSON upload decoding and type mirror. Sync already selects `household_profiles.*`.
Apply through the user's normal migration/sync workflow; implementation does not
apply migrations or restart services.

The 2026-10-28 default-on change uses
`20261028130000_import_conversion_default.sql`. New setups and drafts missing
measurement preferences default conversion on; saved off choices stay off.

### Measurements native check (2026-10-27)

Android API 36 and iPhone 17 / iOS 26.5, light theme and unchanged text size:
both pickers and the import switch worked. Choosing US customary left Celsius
unchanged; Fahrenheit and conversion on survived Back/Continue. Tapping the
switch side turned conversion off. Metric, Celsius, conversion off and each
device's original draft question were restored, and both apps returned to
Welcome. No account, live import or saved-household edit was made.

Native captures are gitignored under `docs/.screenshots/measurements/`, separated
by platform. These checks cover onboarding controls, not household Save, large
text, screen readers or actual model conversions. Automated checks cover draft
recovery, finalization/upload, isolated profile changes, destination-household
lookup and the instructions supplied to import, recipe writing and adjustments.

## Goals: requests and cooking approaches (2026-10-26)

"Set your cooking rules" is the first substantive instruction the user
gives Magpie. Each row has two layers: what the user wants and how Magpie will
help achieve it. The second line names an action, not praise for the approach.
Every rule must cost something; otherwise it should be Magpie's default. Show
the cost through a limit or comparison in the second line. Do not spell out
costs people can work out themselves or add a separate cost explanation.
These are two layers within a choice, not two rounds of questions. There is no
long introduction, generated response or separate explanation after selection.

| Request                        | Approach shown beneath it                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| Keep weeknights quick          | Choose meals with under 30 minutes of prep and hands-on cooking.                   |
| Spend less on food             | Suggest cheaper cuts. Plan meals that share ingredients.                           |
| Help me reduce calories        | Use leaner proteins, more vegetables and less added oil or cream.                  |
| Teach me as I cook             | Explain heat, timing and seasoning, not just the steps.                            |
| Help me cook with children     | Split the steps into children’s jobs and jobs that need an adult.                  |
| Make cooking less overwhelming | Prep everything first, then one task at a time. Takes a little longer overall.     |
| Try new cuisines               | Offer one dish from a cuisine I don’t usually cook, alongside familiar meal ideas. |

The subtitle is "Magpie will follow these when planning meals and writing
cooking steps." "Add a rule" opens the existing custom-entry editor, which asks
"What should Magpie do?" Every second line remains visible before selection; selecting
does not navigate or open another question. Continue finishes the question.
The same rows and meanings appear under "Cooking rules" in household settings. Checkbox accessibility
labels include both the request and its approach.

Goals must change meal ideas, planning and recipe steps, not just the tone of
the reply. The cook and follow-up suggestions receive the same shared goal
instructions. Current requests can override usual priorities; firm dietary
boundaries, equipment limits and shop rules still apply. The order of selected
goals is not a ranking. A real conflict should produce a visible trade-off.

Balanced meals and using up purchases are defaults, not selectable rules. The
assistant prompt and its canonical document require vegetables, a protein source
and something starchy within the chosen diet, without adding pans or side dishes
just to cover food groups. Balance does not imply calorie reduction. Planning
several meals accounts for pack/bunch remainders across distinct meals. Available
ingredients should be used without treating usual staples or purchases as
confirmed stock. Frozen vegetables are not assumed to be cheaper.

- Quick means under 30 minutes of preparation and hands-on work, including mise
  en place. Unattended cooking may take longer; active and elapsed time are
  distinct. Do not meet the limit by overlapping hands-on tasks when calmer
  cooking is also selected.
- Less-overwhelming cooking begins with complete mise en place and keeps
  hands-on tasks sequential. It overrides the cook's default prep-as-you-go and
  multitasking advice. Unattended cooking can overlap one hands-on task.
- Reducing calories does not supply a numerical target or put other household
  members, especially children, on a weight-loss plan. Target configuration is
  deferred: a future target is a saved personal daily target, not per-meal entry.
- Teaching happens through techniques and observable cues in the relevant
  cooking step, not a lecture or an assumption that the user is a beginner.
- Cooking with children means participation, not merely meals children will eat.
  Separate supervised jobs from steps requiring an adult; use known ages and
  abilities without assuming knife/heat safety.
- Exploration goes beyond cuisines the household normally cooks, not just to
  another dish within a familiar cuisine. Declared cuisines give a starting
  point, not a whitelist or proof that every unlisted cuisine is unfamiliar.
  Follow-up suggestions receive that starting point when exploration is chosen.
  Shop rules still govern sourcing; exploration does not permit extra trips.

### Existing answers

Use a generous intent-preserving migration, without re-onboarding or extra
confirmation. Keep the persisted keys for quick meals, budget, confidence and
exploration. They now mean, respectively, quick weeknights (including the
active-time default), spending less, teaching while cooking and trying new
cuisines.

"Cook with what I have", "Make meals balanced" and "Use up what I buy" remain
as selected custom entries. Do not duplicate an existing custom entry with the
same text, ignoring case. Remove the former preset keys from the normalized
value so deleting those custom entries does not bring them back on the next
read. Other custom wishes remain unchanged.

Calorie reduction, cooking with children and less-overwhelming cooking are not
inferred from earlier answers. Missing new keys remain unselected.

The shared profile parser applies this to saved households and recovered local
drafts. Reading does not rewrite database rows; normal goal saves persist the
normalized value. No database migration, sync-rule change or bulk rewrite is
needed. Automated checks cover profile compatibility, draft recovery/removal,
the unconditional cooking defaults, and the chosen instructions reaching both
suggestion paths. They do not prove model adherence or certify native layout and
screen readers.

### Cooking-rules visual check (2026-10-26)

Android API 36, light theme, font scale 1.0, keyboard hidden: two native captures
confirmed the updated heading/subtitle, readable two-line choices, and scrolling
to the last choice and Add a rule above the fixed navigation controls. No goal
selections or saved household answers were changed. The draft was left at the
top of the same question. Captures and context are gitignored under
`docs/.screenshots/onboarding-goals/android/round-01-cooking-rules/`.
This was a layout/scroll check, not a repeat of selection or persistence tests.
The captures precede removal of the two default-behaviour presets and the later
cost-focused copy changes; they do not show the final seven-row list. No repeat
device check was made for that cleanup. iOS, larger text and screen readers
remain device-unverified.

## Shop sourcing rules (2026-10-26)

Onboarding and household settings share one Shops list. Each entry answers
"How should Magpie use this shop?":

- Use for everyday meals: plan around ingredients the household can buy here.
- Offer optional upgrades: occasionally suggest ingredients that improve a meal,
  keeping a version doable from everyday sources.
- Only when it's worth a trip: require a meaningful improvement and look for
  reuse across meals when planning several meals.

No rule is preselected or inferred from a shop's name, size, type or old access
rating. Multiple shops can be everyday sources. The rule choices explain their
effect directly. The household Shops page is just the list and add actions,
without an introductory explanation or a page-level Save button.

The household Shops editor opens as a normal pushed page, like Cuisines &
staples. The list contains compact name/rule rows, never an open shop form.
Onboarding's first arrival at an empty Shops question opens the first shop's
form sheet automatically after "Where do you shop?" has settled into view, not
while the question is a pager look-ahead or still sliding from the previous
question. The question remains the underlying page; "Add a shop" is a task
within it, not a replacement onboarding question.
Save validates and accepts that one shop, closes the editor, and shows the
list. Add another shop opens a new editor; tapping a row opens the same editor
for that shop. Continue on the list advances onboarding. These actions have
distinct jobs: Save finishes one entry; Continue finishes the question.

Cancel, Back or dismissing the sheet leaves the list unchanged. Cancelling the first
entry returns to the empty list, where Continue can skip shops; it does not
automatically reopen the editor. Returning to an existing list never opens a
blank next entry. Each shop opens a single native form sheet above the normal
question/settings page, never above another sheet. It starts at a stable
three-quarter-height detent, can be expanded to full height, and does not resize
to its content. Native sheet gestures expand to the larger detent first;
content can scroll when it still does not fit at full height. The name field
does not take focus on arrival: the keyboard stays hidden until the user chooses
to type. Contents scroll for smaller screens, larger text and the keyboard;
Save stays at the bottom. The editor still makes sense when the background
question is obscured. Other household sections keep their existing presentation.

The iOS sheet uses its native header and Cancel action. Android uses a compact
sheet heading with Cancel and the native sheet-footer slot for Save, so the
action stays at the visible detent rather than outside the sheet's clipped
content. The existing keyboard-aware content and Save/Cancel semantics remain.

Butcher, Asian supermarket, and Weekly market appear as secondary add actions
once a rule has been chosen for at least one shop. They remind users of other
sources. Each opens a fresh editor with the name filled in but no selected
rule. There is no generic Supermarket pill.

Typing and changing a rule only update the editor's local state. An incomplete
Save shows inline feedback and never adds or removes a shop. Removal is an
explicit action for an existing shop. Onboarding publishes the changed list
only after the device-local save succeeds; a failed Save keeps the editor open
with its input intact. Shops remain optional, but the interface invites adding
information rather than advertising that it can be skipped. In household
settings, saving or removing a shop writes that change directly and returns to
the live list. There is no second Save on the page and no page-wide draft.
Existing shopping notes open their own small editor and are saved explicitly;
they are not left as an unsaved inline field on the list.

An existing `main_supermarket` remains readable as a legacy shop. If it is
already listed, keep the explicit entry rather than duplicating it.
Recovering an onboarding draft also folds the old field into `shops` and clears
it, so removing that shop does not bring it back on resume. Saving a household
shop stores the combined list in `shops` and clears the legacy field; cancelling
leaves saved answers unchanged. Shop writes do not replace shopping notes or
other profile fields. Old access ratings stay intact until
edited and do not silently become new instructions. Users choose rules when
editing these shops. No database column or sync-rule change is needed: rules
use the existing JSON array. The cook and its follow-up suggestions receive the
same explicit sourcing instructions; existing shopping notes are retained.

### Earlier native checks

The earlier access-rating, sheet-based editor was verified on Android API 36, light theme, default text size
(1080×2400): no main/other split, all three quick-add pills, adding Butcher as
Special trip, reopening and removing it, the pill returning after removal, and
opening/cancelling a blank name with examples. The original onboarding draft was
retained and the test shop removed. Native captures are gitignored under
`docs/.screenshots/household-shops/android/round-02/`; `round-01/` records earlier
empty-name feedback and access-rating edits. The household page transition,
household persistence, and iOS were not exercised. These checks do not verify
the new sourcing-rule editor.

### Earlier inline sourcing-rule native check (2026-10-26)

Android API 36 confirmed the empty form with no selected rule, choosing everyday
use for a temporary shop, Add another shop preserving it as a summary row,
pushed editing to optional upgrades, native Back, Continue/Back retaining that
rule, and removal returning to an empty form. The temporary shop was removed
and the original onboarding draft retained. Captures are gitignored under
`docs/.screenshots/household-shops/android/round-05/`.

This checks the earlier inline/autosave variant, not the Save/Cancel flow above.
It does not verify household Save/discard, iOS, large text, screen readers, or
the model's actual meal suggestions; automated checks verify that both prompt
paths receive the sourcing instructions, not that a model always follows them.

### Save-to-list native check (2026-10-26, before form-sheet presentation)

Android API 36 confirmed that Continue from the previous question opens the
first shop editor, Save returns to the list without an open form, adding and
saving a second shop returns to the same list, and Continue advances onboarding.
Back cancelled both a new entry and an unsaved rule edit without changing the
list. A saved rule survived Continue/Back. Removing both temporary shops restored
the empty list, which could be skipped without reopening an editor. The original
answers and question were restored; saved households and iOS were not touched.
Native captures are gitignored under
`docs/.screenshots/household-shops/android/round-06/`.

Household persistence, iOS, large text, screen readers and actual model behaviour
remain outside this check. Save/Cancel/list behaviour is unchanged by the later
form-sheet presentation; these captures do not verify the new detent or visible
question context.

### Form-sheet visual check (2026-10-26)

One Android visual check confirmed the question heading visible behind the
three-quarter-height sheet, keyboard hidden on arrival, and Cancel, all three
rule choices, and Save visible. No shop data was entered or saved. The working
capture is gitignored at
`docs/.screenshots/household-shops/android/round-07-form-sheet/01-sheet-context.png`.
The prior Save/Cancel functional flow was not rerun; iOS and keyboard-open sheet
layout remain device-unverified. This capture predates the empty-state copy
cleanup and documents sheet sizing/context, not the final empty-state wording.

## People, food boundaries and familiar cooking (2026-10-27)

### Food rules belong to people

The food-rule question asks how Magpie should plan the onboarding person's
meals. The same instructions appear in every person's editor, not just setup.
Keep the persisted diet keys; the visible choices state what to do:

| Choice                      | Practical meaning                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| More plants, less meat      | Keep meat and fish in the mix. Make more meals plant-based.                                   |
| Include all foods           | No diet-based swaps. Still follow allergies, dislikes and cooking rules.                      |
| Replace meat, keep fish     | Use fish, seafood and vegetarian ingredients instead of meat, including in stocks and sauces. |
| Replace meat and fish       | Use vegetarian ingredients, including in stocks and sauces. Eggs and dairy are fine.          |
| Replace all animal products | Use plant-based alternatives to meat, fish, dairy, eggs and honey.                            |
| Set a different food rule   | Say what to reduce, leave out or replace.                                                     |

The custom field asks “What should Magpie change?” and requires useful text
before continuing/saving. The former Meat heavy key remains readable/editable
as “Protein with every meal” for a person who already has it; it is not offered
as a new reduction/replacement rule. Its saved meaning still allows another
protein source, not only meat. New people start at Include all foods rather
than being silently assigned a reduction in meat. Existing people and drafts
keep their actual saved diet, portions and equipment.

Magpie must apply each food rule to the person it belongs to. A reduction is not
an exclusion. When people eat differently, prefer one shared base with practical
adaptations, rather than making everyone follow one person's diet or defaulting
to separate meals. The cook and follow-up suggestions receive the same meanings
and individual people, not a deduplicated household-wide diet label.

### Who and how much to plan for

“Who should Magpie plan for?” shows the usual eaters and each person's food
rule, helping reference and attendance. It does not require an account for each
person or assume everyone lives together. “Meals to plan” sets the household's
usual meal coverage; “It varies” takes a free-text pattern.

The person editor sets name, age group, food rule, “How much to cook” and
“Include in”. One reference helping is an adult helping; the assistant scales
ingredients to the saved reference instead of reducing it again from age.
Attendance is a flexible default for the assistant, not a fixed schedule or a
change to the manual plan picker's everyone-selected default. A person's absence
also does not establish that shared preparation is safe for an allergy.

Person editors start without focusing a field and use a scrollable native form
sheet, with Save kept at the visible bottom. Save accepts one person; Cancel,
Back and native dismissal discard unsaved edits. Changes affect future planning
and explicit recipe adjustments, not existing recipes. An existing person's
food rule/portion can be changed without having to repeat setup.

### Boundaries carry their exceptions

Allergies/must-avoids and dislikes stay in distinct lists. A shortcut names a
food only; it does not infer an allergy from “Soy” or “Milk”. New boundary entries
require a food and reason before Save. Dislike add actions prefill that reason,
which can still be changed. The editor also records:

- **Who is this for?** Everyone or named people. `person_ids: []` explicitly
  means everyone. A missing field on an older entry leaves the original notes
  in charge; neither reading nor a cancelled edit invents a scope. Missing-person
  references remain visible as “Person no longer listed” rather than being
  silently dropped or broadened to everyone.
- **Traces**, for allergies only: Avoid “may contain” too; “May contain” labels
  are okay; or Check with me. No policy is inferred from the allergen. The last
  choice leaves `trace_policy` absent. The other choices store `avoid` or
  `may-contain-okay`. Changing away from Allergy clears allergy-specific trace
  handling, without deleting the ingredient, people or notes.
- **Forms, preparation or exceptions**: free text, such as raw tomatoes versus
  cooked tomatoes, a tolerated ingredient form, or separate utensils. This is
  not a symptom questionnaire, allergy severity scale or guessed safe quantity.

The interface asks people to follow their existing allergy guidance and says
Magpie cannot check labels or kitchen safety. Permitting precautionary labels
does not permit using the allergen as an ingredient or imply that cross-contact
is safe. With no trace guidance, the assistant excludes the allergen and asks
about traces when relevant; it never assumes traces are okay. Explicit food-form
exceptions stay attached to their people. Contradictory guidance needs a question,
not a guess. Neither a dislike nor a usual purchase overrides an allergy.

Both assistant paths receive these instructions and the original structured
entries. Legacy notes remain editable and binding. Household food-boundary saves
and removals persist directly to the list; there is no second page-wide Save or
nested sheet. Setup saves to the existing local draft before closing an entry.
Failed saves retain input and stay open. No SQL, sync-rule or bulk data migration
is needed: the additional optional fields live inside the existing JSON array.

### Staples teach the cuisine ingredient picker

“What do you usually keep?” comes first, with Cupboard, Fridge and Freezer open.
It introduces the same clay ingredient tiles and selection behaviour used on
the cuisine screen, not a separate compact or text-only variant. Each group
also accepts the user's own ingredients.

“Which cuisines should Magpie start with?” then establishes starting points for
meal ideas. The regional catalogue uses switch rows. Choosing a cuisine shows
its ingredients immediately below it: “I cook Japanese, and these are the things
I keep for it.” There is no separate ingredient accordion. Unselected cuisines
are neither forbidden nor necessarily new. The separate exploration cooking rule
governs trying beyond those starting points. Shop sourcing rules still apply.

Tapping an ingredient records one shared fact wherever it appears. A recognised
name typed in another group carries through without choosing a cuisine for the
user: Parmesan under Fridge is already ticked when Italian is selected later.
Known names match ignoring case and outer whitespace; custom ingredients retain
their original group. Generic names outside Freezer do not imply frozen food.
Unticking a recognised ingredient clears both its stored ID and matching typed
entries, so reading the answers cannot bring it back. Earlier tins/jars entries
appear under Cupboard without rewriting saved profiles or becoming a custom
cuisine.

Switching off a cuisine preserves its ingredients and notes, but does not make
the assistant treat it as familiar cooking. The assistant accounts for missing
ingredients rather than turning a habit into confirmed stock. Household
settings expose Familiar cooking and Usual ingredients as separate rows, using
the same editors as setup.

Welcome describes the setup decisions. The email handoff explains why an email
is needed and says Send code, rather than disguising that action as Continue.
It does not submit an email or create an account just by arriving.

### Staples/cuisines native check (2026-10-27)

Android API 36, light theme, font scale 1.0, 1080×2400: native captures confirmed
the same three-column clay ingredient tiles on staples and beneath a selected
cuisine, without reducing the artwork size. Cupboard, Fridge and Freezer stayed
open while scrolling. Continue from staples reached cuisines. Typing Parmesan
under Fridge left Italian off; selecting Italian immediately showed Parmesan
ticked. Unticking its Italian tile removed the Fridge entry too, and Back kept
it absent.

Temporary ingredients, cuisine selections, the preview person and food-boundary
entries were removed. The original person and answers were retained, and reload
and resume returned to the original restrictions question with no temporary
food-boundary entries. No email was submitted; saved households and iOS were
not operated. Native captures and hierarchy snapshots are gitignored under
`docs/.screenshots/profile-redesign/android/round-03-staples-cuisines/`.

Maestro flows were interrupted by device-connection errors; ADB interactions
with fresh native hierarchies verified the results above. This is not a passing
end-to-end Maestro suite or a new independent visual critique. Household saves,
iOS, large text, screen readers and actual model adherence remain unverified.
Automated checks cover ingredient recognition/removal, legacy group handling,
draft question order and both assistant-context paths.

A follow-up Android capture confirmed filled Material check circles on selected
clay tiles, replacing the outlined symbol-font glyph at the same size. The
current screen and selections were left untouched. This was a visual-only check;
its capture is under `android/round-04-filled-check/` beside the earlier round.

## Native behaviour and verification

Continue remains enabled for missing answers. On tap, show an inline error and
focus the relevant input. This includes custom diet, person name, custom
ingredients/equipment/goals, email, and incomplete verification codes.
Disable duplicate in-flight requests, not incomplete answers.

Inputs share white/card surfaces, warm borders and visible focus/error states.
The buttons float over the same translucent scroll-edge fade as the recipe
screen; there is no footer bar or glass panel. Only the controls themselves use
Liquid Glass. Both controls move in one keyboard-following container, with 8pt
below them when the keyboard is open. Their native hosts ignore keyboard safe
areas so only the shared container adjusts their position. Keyboard-aware
scrolling clears focused inputs above the controls. Large text reflows choices and navigation.
Selection never advances automatically; native paging and reduced motion remain.
Selected clay tiles use filled check circles: Material on Android and the filled
SF Symbol on iOS.

Automated checks cover draft compatibility, durable finalization of structured
choices, profile-context meanings, section-edit isolation, and portion sizing.
Native acceptance is still required for:

1. Every question, including empty/selected/custom and back/resume states.
2. Person sheet with keyboard, custom diet, portion slider and own-person edits.
3. Avoidance/custom-entry sheets: save, cancel, dismiss and removal; first-shop
   entry, Save to list, adding another shop, Back/Cancel, and removal.
4. Small-screen and large-text scrolling; keyboard-following controls on both OSes.
5. VoiceOver/TalkBack labels, selected states, slider quarter-step adjustments.
6. Full code paste/autofill, incomplete-code feedback, wrong code and resend.
7. Final save against the migrated backend and PowerSync upload.

## Rollout

Migration: `20261013160000_onboarding_choices.sql`. Apply through the user's
normal stack workflow, refresh sync configuration, and regenerate DB types.
The migration, client mirror, upload decoding, and type mirror are included.
Sync streams select `household_profiles.*` and `household_people.*`, including
the added columns. Implementation does not apply migrations or restart services.
