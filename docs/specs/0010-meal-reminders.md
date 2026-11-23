# Meal reminders

Shaped in conversation, 2026-10-09. Design: ADR 25. Delivery: ADR 19.

## Behavior

1. At 8:00 in each device's time zone, every member hears about today. No
   off switch yet; the OS can silence the app.
2. A planned day always gets a reminder: time to take something out of the
   freezer or shop. Any planned slot counts.
3. An empty day gets one on the two days after the last planned day, then on
   the first day of the household's usual block: Monday if the last planned
   day was a weekday, Saturday if it was a weekend. That covers weekday cooks,
   weekend cooks and holidays without nagging. Never planned: Mondays.
4. Text:

   | Day      | Title          | Body                                                 |
   | -------- | -------------- | ---------------------------------------------------- |
   | One meal | Today's dinner | Lasagne · 2 items still to buy                       |
   | Several  | Today          | Lunch: Soup · Dinner: Lasagne · 2 items still to buy |
   | Empty    | Dinner idea    | The household's top dinner suggestion                |

   Items to buy are active List items of today's meals; none, no mention.
   If no suggestion is available, the empty-day push uses “Tonight's dinner”
   and a rotating line from `_shared/meal-reminder-text.ts`.

5. Tapping opens Meals in that household on that day. A suggestion push opens
   Dinner with the named recipe first, then the rest of the saved shortlist.
   If dinner is already planned, the plan takes precedence. Nothing is planned
   just by tapping the push.
6. Reminders stay out of the activity feed. Devices without a time zone
   (older builds) get none.
7. Not in scope: off switch, per-meal reminders, smarter copy (last meal,
   weekday).

## Build (built; device check pending)

Migration `20261010100000_meal_reminders.sql`: `empty_day_reminder_due`,
`notification_deliveries.reminder_date`, `queue_meal_reminders(now_at)`, cron
queues before dispatch, claim returns `day_meals` and `items_to_buy`.
`_shared/meal-reminder-text.ts`, `pushMessage` case. Payload as for meals,
`activityId` null; mobile routing needed no change.

Tests: `supabase/tests/meal-reminders.sql` (rule table, queueing window and
reruns, household rhythm, claim), `_shared/meal-reminder-text.test.ts`,
`notification-delivery.test.ts`.

### Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm --filter mobile test`,
  `pnpm supabase test db`, Deno tests for `_shared/`.
- Device: a planned day pushes shortly after 8:00 with the right meals and
  item count; tapping opens Meals on today. An empty day the day after the
  last planned one pushes the invite. Nothing shows in the activity feed.

## Release

Deploy `notification-worker` first: an old worker would send reminders as
broken meal pushes, while the new one works with the old schema. Then apply
the migration and run `pnpm db:types`. No sync or mobile
change needed. Needs the Vault secrets from spec 0007.

## Shared dinner suggestions

The first eligible empty-day delivery triggers Jev from the API. It uses the
household's preferences, plans, and cookbook plus built-in recipes. The
server-only `meal_reminder_suggestions` table stores one shortlist per household
and reminder date, so members and devices get the same pick even across time
zones. The worker sends the name only after saving the shortlist, and only to
devices that registered support for opening it. Older builds still get generic
reminders. Other notifications and planned-day reminders do not wait for Jev.

Apply `20261123100000_meal_reminder_suggestions.sql` and release the API, edge
functions, and mobile tap handling. Enable the integration by setting
`MEAL_REMINDER_API_URL` to the API origin in the edge functions and
`NOTIFICATION_WORKER_SECRET` in the API to match the edge secret. Leave the URL
unset to keep generic pushes. With no Jev key or usable result, the worker
falls back to the generic reminder.

Device check: use two phones with members of one household, one with another household
selected. Verify both see the same named pick, tapping switches households
and shows that recipe first, and planning dinner on one device makes the other
show the plan instead. Verify planned-day and generic fallback pushes still
open the date without expanding suggestions.
