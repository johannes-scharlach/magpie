-- Cuisines the household cooks, and the distinctive ingredients it keeps.
-- keeps holds catalog ingredient ids shared across cuisines; cuisines holds
-- {cuisine, extras} entries with the user's own words. pantry and
-- fresh_ingredients remain for existing households but are no longer asked.
ALTER TABLE public.household_profiles
  ADD COLUMN keeps jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(keeps) = 'array'),
  ADD COLUMN cuisines jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(cuisines) = 'array');
