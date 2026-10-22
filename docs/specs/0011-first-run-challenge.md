# First-run challenge

Status: shaped, signed off 2026-10-13. Builds on `0003-profile-onboarding.md`.
Revised 2026-10-20: couch-first presentation and an earned month of Pro at launch.
Revised 2026-10-21: invitation-first card, expanded reward explanation, compact empty week.

## Problem

Onboarding is a questionnaire. A new user answers eleven screens and reaches
the account step without having felt what Magpie does. The profile answers go
into a void: nothing shows how they change a meal or a shop.

Meal ideas generated from a near-empty profile read as generic, and a
chat-only first experience feels like "I already have this with ChatGPT".
That is also not how the app is used: a session usually starts from an
ingredient at hand or a dish in mind, and the meal gets worked out together.
Week planning feels much better once the cookbook holds the user's own
recipes.

## Experience priorities

Magpie's distinctive pleasure is co-creating with an assistant: the user helps
shape a recipe rather than receiving a finished one that only partly fits.
Weekly planning is the same collaboration at a larger scale, adapting familiar
recipes to this week's needs. A personal cookbook gives that conversation
concrete starting points and reduces the number of decisions made from scratch.

Immediately after onboarding, Home should first invite a manageable, rewarding
experience of that collaboration. The challenge explains what the user gets
from each exploration, not just what action to perform. Featured invitations
and their cues name the benefit and the collaboration, then explain where to
start. Imports provide familiar starting points for future weekly plans.

As useful content accumulates, Home's everyday priorities are:

1. What's on the menu today.
2. The week plan.
3. Making something now.
4. What happened in the household.

Challenge completion is a measurable exploration milestone, not proof of a
personal aha moment. A quieter invitation after a first meaningful co-created
result is an agreed direction, but its trigger and presentation still need
shaping. This copy change does not implement that lifecycle change.

## Solution

After sign-in, Home shows a challenge card. It gives the user goals, not a
tour: the real app is what they learn. Nothing in the app is highlighted or
overlaid; each goal's text says what to do and where, and the user finds the way.
Tasks are intentionally non-tappable.

Completing the challenge earns one free month of Pro **when Pro launches**.
The collapsed card leads with the featured co-creation invitation, not Pro.
Expanded details say “Finish all five to earn a month of Pro.” followed by
“Any order. No need to cook them now.” This makes the complete set, rather than
one task, the condition of earning the reward. Future availability is explained
only on the earned-reward receipt. It is not a trial starting now. No launch
date, Pro features, expiry or redemption flow is invented.

Empty screens on Meals, Shop and Cookbook state a goal in plain words. They
show whenever the screen is empty, not only on first use. Planning a meal and
choosing what to buy are learned there, not in the challenge.

## Challenge goals

| Goal                        | Target | Shown as     |
| --------------------------- | ------ | ------------ |
| Start from an idea          | 1      | Completion   |
| Chat about a recipe         | 1      | Completion   |
| Try a dish you have in mind | 1      | Completion   |
| Try ingredients you have    | 1      | Completion   |
| Import your go-to recipes   | 5      | Recipe count |

The collapsed card features the first incomplete goal in this order. It
starts with reacting to an illustrated idea: no kitchen inventory, recipe
search, or physical cooking required. The first saved recipe then supplies
something concrete to chat about. No heuristic priorities or special cases.

Overall progress and a native disclosure reveal the complete list. All goals
can be completed in any order, including imports from the beginning. Five
imports remain meaningful effort toward the reward, not a gate on exploration.

- Five imports make the cookbook feel like the user's own. The four single
  goals each try one way into a meal.
- Any import mode counts (URL today; others later).
- The three chat goals count once the chat saves a recipe. Planning from chat
  requires a saved recipe (`planMeal` in `apps/api/src/chat-tools.ts`), so a
  planned chat meal always counts.
- "Start a chat on a recipe" means a chat started from a recipe page (ADR 14).
  Any recipe page counts.

## Card lifecycle

- The card sits on Home and cannot be dismissed.
- The server records the reward automatically when every goal is met, even
  if Home is not open. After sync, the card becomes a compact earned-reward
  receipt. Done dismisses the receipt, not the reward.
- Local completion awaiting server sync is not presented as a saved reward.
- Once earned, removing recipes/chats or leaving a household cannot revoke it.
- Progress is per user. People who join a household by invitation get the
  challenge too; household recipes created by others do not count for them.

## Counting progress

Unfinished progress is derived from data the app already writes. The earned
reward and its dismissal are permanent account state (see below).

| Goal         | Counted from                                         |
| ------------ | ---------------------------------------------------- |
| Imports      | `recipes` with `origin = import`, `created_by` = me  |
| On hand      | `recipes` with `origin = on_hand`, `created_by` = me |
| Dish in mind | `recipes` with `origin = dish`, `created_by` = me    |
| From an idea | `recipes` with `origin = idea`, `created_by` = me    |
| Recipe chat  | `chats` with `recipe_id` set, `created_by` = me      |

### Schema

- `chats.entry`: `on_hand` | `dish` | `idea`, nullable. Set when the chat
  starts from Home's on-hand chips, the dish-in-mind entry, or an idea. Recipe
  chats leave it null; `recipe_id` already marks them.
- `recipes.origin`: `import` | `on_hand` | `dish` | `idea`, nullable. Import
  sets `import`. `addToCookbook` copies the chat's `entry`.
- Backfill: recipes with `from_url` get `origin = import`. Recipes saved from
  older chats stay null and do not count.

Follow `docs/schema-changes.md`: both columns land in the migration, the sync
config and the client schema.

## Earned reward and finish moment

`first_run_rewards` has one row per account (`id` = auth user id), with
`earned_at` and nullable `dismissed_at`. The row promises one month of Pro at
launch; it does not enable Pro or start a subscription.

Postgres checks eligibility on recipe-origin and recipe-chat writes, using
the same five thresholds above. Per-account locking serializes concurrent
finishing writes; retries cannot create another reward. Eligible existing
accounts are backfilled. Clients can read their own row and update only its
`dismissed_at`, never mint a reward or rewrite `earned_at`.

The table is published, mirrored in the mobile schema, and synced by account,
not household membership. Done updates dismissal directly through Supabase;
a failed save leaves the receipt visible with retry feedback. The earned
record survives dismissal and remains available for future Pro fulfillment.

The old `first_run_challenge_finished_at` user-metadata flag is respected only
to avoid restoring an old dismissed checklist when no reward exists. It is
not trusted as proof of reward eligibility. An actual backfilled reward gets
its own new receipt.

## Contextual weekly planning

On Plan meals, households with fewer than five saved recipes see why adding
favorites improves the plan. Adding a favorite opens the existing import
sheet; closing it returns to the same planning form. Planning without imports
remains available. This explanation belongs at the point of intent, rather
than making five imports the first step for every new user.

On Home, the week keeps its seven existing day labels, each inside a quiet
rounded day tile. These labelled calendar cells anchor the empty week without
pretending there are meals waiting to load. When the entire week is empty,
omit reserved meal positions; day links retain their 44-point minimum height.
Populated weeks keep two meal positions per day inside the same day tiles.
Only actual planned meals draw markers; empty meal slots have no placeholder
outlines. No additional dates or expanded labels are added. All weekday labels
use the same foreground color; today is distinguished only by bold weight.

Major Home sections have 40-point separation, with smaller gaps within each
section. The challenge's top spacing is tuned separately for iOS's large title
and Android's toolbar, without changing native header or scroll insets.

Meals is the everyday planning workspace. Home's "See week" link and the
tappable "No meals planned yet." row open Meals, not the assisted-planning
form. Individual days still open the selected day. Meals offers "Plan with
Magpie" as a secondary header action into the existing assisted-planning flow.
Direct and assisted planning are two methods of the same task, not competing
Home destinations. Routine planning does not require a conversation.

Home's co-creation entries and Cookbook's contextual scheduling stay available.
Adding a new per-meal chat entry from a selected planning slot is deferred.

## Not in this spec

- The profile questions before email. They stay as in 0003.
- New import modes (voice, screenshot, photo). Independent work; the import
  goal counts whatever import offers.
- Pro billing, benefits, launch scheduling, and redemption/activation. The
  earned promise is recorded now; fulfillment comes with Pro.
- The visual redesign of the existing questions. That is the designer brief
  from the onboarding review.
