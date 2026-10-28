begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(4);

-- Anna photographed a cookbook and put her phone away. Her old tablet signed
-- out. Ben shares the household but did not import anything.
insert into auth.users (id) values
  ('a1000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000002');
insert into public.lists (id, name, created_by) values
  ('b1000000-0000-4000-8000-000000000001', 'Family', 'a1000000-0000-4000-8000-000000000001');
insert into public.list_members (list_id, user_id) values
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002');
insert into public.push_devices (id, installation_id, user_id, expo_push_token, platform, disabled_at) values
  ('a2000000-0000-4000-8000-000000000001', gen_random_uuid(),
   'a1000000-0000-4000-8000-000000000001', 'ExpoPushToken[anna]', 'ios', null),
  ('a2000000-0000-4000-8000-000000000002', gen_random_uuid(),
   'a1000000-0000-4000-8000-000000000001', 'ExpoPushToken[anna-tablet]', 'ios', now()),
  ('a2000000-0000-4000-8000-000000000003', gen_random_uuid(),
   'a1000000-0000-4000-8000-000000000002', 'ExpoPushToken[ben]', 'ios', null);
insert into public.import_operations (user_id, operation_id, outcome, review) values
  ('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'review',
   '{"listId": "b1000000-0000-4000-8000-000000000001",
     "recipes": [{"name": "Miso beans"}, {"name": "Lemon traybake"}],
     "skipped": [{"name": "Aubergine pasta", "reason": "The steps are cut off."}]}'),
  ('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'review',
   '{"listId": "b1000000-0000-4000-8000-000000000001",
     "recipes": [{"name": "Dal"}, {"name": "Rice"}], "skipped": []}');

select queue_import_review('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001');
select queue_import_review('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001');
select results_eq(
  $$select device_id from notification_deliveries
    where import_operation_id = 'c1000000-0000-4000-8000-000000000001'$$,
  $$values ('a2000000-0000-4000-8000-000000000001'::uuid)$$,
  'Only the importing user''s active devices hear, once');

select throws_ok(
  $$insert into notification_deliveries (list_id, user_id, device_id, reminder_date, import_operation_id)
    values ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
            'a2000000-0000-4000-8000-000000000001', '2026-10-28', 'c1000000-0000-4000-8000-000000000001')$$,
  '23514', null,
  'A delivery is about one thing');

-- The second review was already decided on another device.
select queue_import_review('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002');
update import_operations set outcome = 'saved', review = null
  where operation_id = 'c1000000-0000-4000-8000-000000000002';

select set_config('request.jwt.claim.role', 'service_role', true);
select results_eq(
  $$select kind, import_operation_id, recipe_count, skipped_count
    from claim_notification_deliveries(gen_random_uuid())
    where device_id = 'a2000000-0000-4000-8000-000000000001'$$,
  $$values ('import_review', 'c1000000-0000-4000-8000-000000000001'::uuid, 2, 1)$$,
  'The worker reads how many recipes wait, and skips a review already decided');
select set_config('request.jwt.claim.role', '', true);

select is(
  (select status from notification_deliveries
    where import_operation_id = 'c1000000-0000-4000-8000-000000000002'),
  'cancelled',
  'A review decided before the push went out is not announced');

select * from finish();
rollback;
