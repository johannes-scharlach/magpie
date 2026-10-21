begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(16);

-- These accounts and household exist only inside this rolled-back test.
insert into auth.users (id) values
  ('a3000000-0000-4000-8000-000000000001'),
  ('a3000000-0000-4000-8000-000000000002');
insert into public.lists (id, name, created_by) values
  ('b3000000-0000-4000-8000-000000000001', 'Challenge test', 'a3000000-0000-4000-8000-000000000001');
insert into public.list_members (list_id, user_id) values
  ('b3000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001'),
  ('b3000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002');

insert into public.recipes (list_id, created_by, origin)
  select 'b3000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', origin
  from unnest(array['import', 'import', 'import', 'import', 'idea', 'dish', 'on_hand']) as origin;
insert into public.recipes (list_id, created_by, origin) values
  ('b3000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002', 'import');
insert into public.chats (list_id, created_by, recipe_id)
  select list_id, 'a3000000-0000-4000-8000-000000000002', id from recipes
  where created_by = 'a3000000-0000-4000-8000-000000000002';
select is((select count(*)::integer from first_run_rewards
  where id = 'a3000000-0000-4000-8000-000000000001'), 0,
  'Another household member cannot complete your challenge');

insert into public.chats (list_id, created_by, recipe_id)
  select list_id, created_by, id from recipes
  where created_by = 'a3000000-0000-4000-8000-000000000001' and origin = 'idea';
select is((select count(*)::integer from first_run_rewards
  where id = 'a3000000-0000-4000-8000-000000000001'), 0,
  'Four imports are not enough, even with every exploration done');

insert into public.recipes (list_id, created_by, origin) values
  ('b3000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'import');
select ok((select earned_at is not null and dismissed_at is null from first_run_rewards
  where id = 'a3000000-0000-4000-8000-000000000001'),
  'The last requirement automatically earns a reward before any Done action');
select set_config('test.reward_earned_at', (select earned_at::text from first_run_rewards
  where id = 'a3000000-0000-4000-8000-000000000001'), true);

update public.recipes set origin = origin
  where created_by = 'a3000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from first_run_rewards
  where id = 'a3000000-0000-4000-8000-000000000001'), 1,
  'Replayed writes cannot earn a second month');
select is((select earned_at::text from first_run_rewards
  where id = 'a3000000-0000-4000-8000-000000000001'), current_setting('test.reward_earned_at'),
  'Replayed writes preserve the original earning moment');

delete from public.chats where created_by = 'a3000000-0000-4000-8000-000000000001';
delete from public.recipes where created_by = 'a3000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from first_run_rewards
  where id = 'a3000000-0000-4000-8000-000000000001'), 1,
  'Removing recipes and chats cannot take back an earned reward');

-- The recipe-chat goal can also be the last requirement, in either order.
delete from public.chats where created_by = 'a3000000-0000-4000-8000-000000000002';
insert into public.recipes (list_id, created_by, origin)
  select 'b3000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002', origin
  from unnest(array['import', 'import', 'import', 'import', 'idea', 'dish', 'on_hand']) as origin;
select is((select count(*)::integer from first_run_rewards
  where id = 'a3000000-0000-4000-8000-000000000002'), 0, 'The recipe-chat requirement cannot be skipped');
insert into public.chats (list_id, created_by, recipe_id)
  select list_id, created_by, id from recipes
  where created_by = 'a3000000-0000-4000-8000-000000000002' and origin = 'idea';
select ok(exists(select 1 from first_run_rewards
  where id = 'a3000000-0000-4000-8000-000000000002'),
  'Progress in any order earns the same reward');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from first_run_rewards), 1, 'Only your own reward is readable');
select throws_ok($$insert into first_run_rewards (id) values ('a3000000-0000-4000-8000-000000000001')$$,
  '42501', 'permission denied for table first_run_rewards', 'The client cannot mint a reward');
select throws_ok($$update first_run_rewards set earned_at = now()$$,
  '42501', 'permission denied for table first_run_rewards', 'The client cannot rewrite the reward');
select throws_ok($$delete from first_run_rewards$$,
  '42501', 'permission denied for table first_run_rewards', 'The client cannot delete the reward');
select throws_ok($$select record_first_run_reward('a3000000-0000-4000-8000-000000000001')$$,
  '42501', 'permission denied for function record_first_run_reward', 'The internal award function is not a public claim endpoint');
update first_run_rewards set dismissed_at = now()
  where id = 'a3000000-0000-4000-8000-000000000001';
select ok((select dismissed_at is not null and earned_at is not null from first_run_rewards),
  'Done dismisses the card without removing its earned month');
update first_run_rewards set dismissed_at = now()
  where id = 'a3000000-0000-4000-8000-000000000002';
reset role;
select ok((select dismissed_at is null from first_run_rewards
  where id = 'a3000000-0000-4000-8000-000000000002'), 'You cannot dismiss someone else''s reward');
select is((select count(*)::integer from first_run_rewards
  where id in ('a3000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002')), 2,
  'Rewards are personal, not one per household');

select * from finish();
rollback;
