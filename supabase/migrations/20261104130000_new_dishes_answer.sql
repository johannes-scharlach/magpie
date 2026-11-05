-- A favourites/discoveries choice now starts an editable answer, not an enum.
-- Keep the existing text column and all saved preset keys readable.
alter table public.household_profiles
  drop constraint household_profiles_new_dishes_check;
