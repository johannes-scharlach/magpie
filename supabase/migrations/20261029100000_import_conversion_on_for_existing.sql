-- Conversion is on by default now. Rows created while the old default was off
-- still carry that value, and PowerSync already gave it to existing devices.
-- Move only the untouched default; a changed system or temperature is a real
-- choice and stays as it is.
update public.household_profiles
set measurements = jsonb_set(measurements, '{convert_imports}', 'true'::jsonb)
where measurements = '{"system":"metric","temperature":"celsius","convert_imports":false}'::jsonb;
