-- Cooking a cuisine and keeping things for it are separate facts. cuisines
-- becomes the ids they cook; extras holds their own words by the cuisine they
-- were added under, so switching a cuisine off forgets nothing. Everyday is
-- kept, never cooked: it splits into staple groups, its words move to the
-- cupboard and it leaves cuisines. Oats and plain lentils left the catalog.
ALTER TABLE public.household_profiles
  ADD COLUMN extras jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(extras) = 'object');

UPDATE public.household_profiles
SET
  extras = COALESCE(
    (SELECT jsonb_object_agg(
              CASE WHEN entry->>'cuisine' = 'everyday' THEN 'cupboard'
                   ELSE entry->>'cuisine' END,
              entry->'extras')
       FROM jsonb_array_elements(cuisines) AS entry
      WHERE jsonb_array_length(COALESCE(entry->'extras', '[]'::jsonb)) > 0),
    '{}'::jsonb),
  cuisines = COALESCE(
    (SELECT jsonb_agg(entry->>'cuisine' ORDER BY position)
       FROM jsonb_array_elements(cuisines) WITH ORDINALITY AS e(entry, position)
      WHERE entry->>'cuisine' <> 'everyday'),
    '[]'::jsonb),
  keeps = keeps - 'oats' - 'lentils';
