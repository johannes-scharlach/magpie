-- Kitchen habits (spec 0014): soft planning rules the household chose.
-- day_habits: [{ days: ["mon", ...], meal: "lunch"|"dinner"|"treat", what }],
-- where what is a catalog cuisine id or a tag. new_dishes: how much the plan
-- reuses dishes they already cook; null means no rule.
alter table public.household_profiles
  add column day_habits jsonb not null default '[]'::jsonb
    check (jsonb_typeof(day_habits) = 'array'),
  add column new_dishes text
    check (new_dishes in ('rarely', 'sometimes', 'often'));
