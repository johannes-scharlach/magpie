-- Default new households to conversion on; leave saved choices unchanged.
ALTER TABLE public.household_profiles
  ALTER COLUMN measurements SET DEFAULT
    '{"system":"metric","temperature":"celsius","convert_imports":true}'::jsonb;
