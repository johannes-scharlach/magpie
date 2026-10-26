begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(4);

insert into auth.users (id) values
  ('a1000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000002');
insert into public.lists (id, name, created_by) values
  ('b1000000-0000-4000-8000-000000000001', 'Family', 'a1000000-0000-4000-8000-000000000001');
insert into public.household_profiles (id) values ('b1000000-0000-4000-8000-000000000001');
insert into public.list_members (list_id, user_id) values
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001');

-- Voice messages (ADR 32) live under the list's id, like chat images.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select lives_ok($$insert into storage.objects (bucket_id, name, owner_id)
  values ('chat-voice', 'b1000000-0000-4000-8000-000000000001/recipe.m4a', 'a1000000-0000-4000-8000-000000000001')$$,
  'A member records into the household''s folder');
select is((select count(*)::integer from storage.objects
  where bucket_id = 'chat-voice' and name like 'b1000000-0000-4000-8000-000000000001/%'),
  1, 'A member can play the household''s recordings');

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from storage.objects
  where bucket_id = 'chat-voice' and name like 'b1000000-0000-4000-8000-000000000001/%'),
  0, 'Someone outside the household cannot play them');
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id)
  values ('chat-voice', 'b1000000-0000-4000-8000-000000000001/other.m4a', 'a1000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'Someone outside the household cannot record into it');

select * from finish();
rollback;
