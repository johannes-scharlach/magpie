-- Household-wide units. Import conversion is opt-in and affects future imports only.
ALTER TABLE public.household_profiles
  ADD COLUMN measurements jsonb NOT NULL
    DEFAULT '{"system":"metric","temperature":"celsius","convert_imports":false}'::jsonb
    CHECK (jsonb_typeof(measurements) = 'object');
