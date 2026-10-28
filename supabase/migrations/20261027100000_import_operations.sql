-- ADR 34: how an import operation ended, so a cancel and a save agree on one
-- outcome whichever API machine handles each. Written by the API only.
create table public.import_operations (
  user_id uuid not null references auth.users (id) on delete cascade,
  operation_id uuid not null,
  outcome text not null check (outcome in ('saved', 'cancelled')),
  variant_id uuid,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);
comment on table public.import_operations is
  'Saved or cancelled, per import operation. A cancel after the save reports the save instead.';

alter table public.import_operations enable row level security;
revoke all on public.import_operations from public, anon, authenticated;
grant all on public.import_operations to service_role;
