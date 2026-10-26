# Onboarding: useful choices, native controls

Implemented 2026-10-13. This supersedes the presentation, restriction entry,
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
every question into the shops' three-choice pattern. Goals and shops now use
this approach. The direction for the remaining questions is agreed, but their
interface changes are not implemented:

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

The flow retains name, goals, diet, household, avoidances, shops, equipment,
pantry, fresh, email, and code. Household add/edit remains a native form sheet on
iOS, with editable creator details and a scrollable keyboard-aware layout.

- Goals: seven multi-select rows, each pairing a request with how Magpie will
  act on it. Custom entries remain possible; no preselection, ranking or extra
  configuration step.
- Diet: compact single-select tiles; explain only the selected diet.
- Household: names, ages, diets, portion references, attendance, and normal meals.
- Avoidances: separate allergies/must-avoids from dislikes on one screen.
  Common shortcuts and a native editor record ingredient, reason, and optional
  detail (including who it applies to). Continue always reads Continue; the empty
  state explicitly says it is fine to continue with nothing to avoid.
- Shops: one list of named sources, each with a user-chosen sourcing rule:
  everyday meals, optional upgrades, or only when a trip is worthwhile. The
  first arrival opens one form sheet over the question; Save returns to the list. Butcher,
  Asian supermarket, and Weekly market are secondary prompts for other sources.
  No separate main shop or compulsory retailer-type field.
- Equipment: illustrated two-column grid. Oven/stove start selected and can be
  deselected. Custom equipment remains possible.
- Pantry: concrete items the household nearly always keeps.
- Fresh: concrete foods bought regularly, describing rotation and household
  habits rather than simultaneous stock. Greek and plain yoghurt are separate.
- Both staple screens: six initial suggestions, More ingredients, and custom
  items. Nothing preselected, no minimum required. Selected extra items stay
  visible when revisiting the screen. Existing category answers remain available
  under Earlier selections and can be removed; they never become specific foods.
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
- `household_people.portion_reference`: 0.25–4 regular adult portions in quarter
  steps, default 1. The creator and other people use the same editor. Recipe
  generation sums the selected people's references, then adds per-meal extra
  portions. Do not reduce an explicit reference again based on age.
- `household_profiles.ingredient_avoidances`: JSON array of
  `{ ingredient, kind: allergy | restriction | dislike, detail }`.
- `household_profiles.shops`: JSON array of
  `{ name, rule: everyday | upgrade | worth-trip }`. Older `access` ratings
  remain readable but do not imply a sourcing rule. A new entry stays local to
  its editor until Save validates both name and rule. Continue on the list
  requires explicit rules for existing named shops. Blank or cancelled entries
  are not stored.
- Existing `restrictions` and `other_shops` strings remain readable/editable
  notes. No attempt to guess or parse their meaning into the new structured
  choices. The assistant receives both.
- Pantry/fresh keep their existing JSON selection shape. New item keys and old
  category keys are distinct except eggs, which was already an exact ingredient.
  Missing keys remain unselected; custom strings remain supported.
- The assistant receives usual pantry items, regular fresh purchases, and legacy
  categories separately. All are habits, not confirmed inventory.
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
