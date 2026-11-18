-- The household a user chose on the OAuth consent page. Server-only: RLS is
-- on with no policies, so only the API's direct Postgres connection reads it.
-- Not a synced table; devices never see or write this row.
create table public.mcp_households (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  list_id    uuid not null references public.lists (id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.mcp_households enable row level security;
