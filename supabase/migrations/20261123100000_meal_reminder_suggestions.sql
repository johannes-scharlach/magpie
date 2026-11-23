-- Server-only snapshot. Push deliveries remain per device, but share the
-- result (including a generic fallback) for a household/date.
create table public.meal_reminder_suggestions (
  list_id uuid not null references public.lists(id) on delete cascade,
  reminder_date date not null,
  -- NULL while the winning request is ranking; [] is the generic fallback.
  recommendations jsonb check (jsonb_typeof(recommendations) = 'array'),
  created_at timestamptz not null default now(),
  primary key (list_id, reminder_date)
);

alter table public.meal_reminder_suggestions enable row level security;
revoke all on public.meal_reminder_suggestions from public, anon, authenticated;

-- An old client can still open the date, but cannot show a saved shortlist.
alter table public.push_devices
  add column supports_dinner_suggestions boolean not null default false;

alter function public.register_push_device(uuid, text, text, text)
  rename to register_push_device_base;
revoke all on function public.register_push_device_base(uuid, text, text, text)
  from public, anon, authenticated, service_role;

create function public.register_push_device(
  target_installation_id uuid,
  target_expo_push_token text,
  target_platform text,
  target_time_zone text default null,
  target_supports_dinner_suggestions boolean default false
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  device_id uuid;
begin
  device_id := public.register_push_device_base(
    target_installation_id, target_expo_push_token, target_platform, target_time_zone
  );
  update public.push_devices
    set supports_dinner_suggestions = coalesce(target_supports_dinner_suggestions, false)
    where id = device_id;
  return device_id;
end;
$$;
revoke all on function public.register_push_device(uuid, text, text, text, boolean)
  from public, anon;
grant execute on function public.register_push_device(uuid, text, text, text, boolean)
  to authenticated, service_role;
