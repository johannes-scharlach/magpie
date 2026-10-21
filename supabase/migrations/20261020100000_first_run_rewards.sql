-- Spec 0011: earn a month of Pro now, use it when Pro launches. The server
-- records the reward when the last requirement arrives, not when Home opens
-- or someone presses Done. No billing or redemption machinery yet.
create table public.first_run_rewards (
  id uuid primary key references auth.users (id) on delete cascade,
  earned_at timestamptz not null default now(),
  dismissed_at timestamptz
);
comment on table public.first_run_rewards is
  'One month of Pro at launch, earned per account. Dismissing Home does not revoke the reward.';

alter table public.first_run_rewards enable row level security;
create policy "read your earned reward" on public.first_run_rewards
  for select to authenticated using (id = auth.uid());
create policy "dismiss your earned reward" on public.first_run_rewards
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke all on public.first_run_rewards from public, anon, authenticated;
grant select, update (dismissed_at) on public.first_run_rewards to authenticated;
grant all on public.first_run_rewards to service_role;

create index recipes_creator_origin_idx on public.recipes (created_by, origin);
create index chats_creator_recipe_idx on public.chats (created_by) where recipe_id is not null;

create function public.record_first_run_reward(target_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if target_user_id is null or exists (
    select 1 from public.first_run_rewards where id = target_user_id
  ) then
    return;
  end if;

  -- Two devices can finish different requirements at once. Check again
  -- after serializing, so the later transaction sees the other's commit.
  perform pg_advisory_xact_lock(hashtextextended('first-run-reward:' || target_user_id::text, 0));
  insert into public.first_run_rewards (id)
    select target_user_id
    where (
      select count(*) filter (where origin = 'import') >= 5
        and count(*) filter (where origin = 'idea') >= 1
        and count(*) filter (where origin = 'dish') >= 1
        and count(*) filter (where origin = 'on_hand') >= 1
      from public.recipes where created_by = target_user_id
    ) and exists (
      select 1 from public.chats
      where created_by = target_user_id and recipe_id is not null
    )
    on conflict (id) do nothing;
end $$;
revoke execute on function public.record_first_run_reward(uuid) from public, anon, authenticated;

create function public.check_first_run_reward()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.record_first_run_reward(new.created_by);
  return new;
end $$;
revoke execute on function public.check_first_run_reward() from public, anon, authenticated;

create trigger recipes_check_first_run_reward
  after insert or update of origin, created_by on public.recipes
  for each row when (new.created_by is not null and new.origin is not null)
  execute function public.check_first_run_reward();
create trigger chats_check_first_run_reward
  after insert or update of recipe_id, created_by on public.chats
  for each row when (new.created_by is not null and new.recipe_id is not null)
  execute function public.check_first_run_reward();

-- Existing completions earn the same promise. Do not trust the old,
-- user-editable dismissal flag as evidence of eligibility.
select public.record_first_run_reward(created_by)
  from public.recipes where created_by is not null group by created_by;

alter table public.first_run_rewards replica identity full;
alter publication powersync add table public.first_run_rewards;
