-- ADR 37: historical model input for chat retrospectives. Server-only: these
-- snapshots duplicate prompts and history, so they stay outside PowerSync.
create table public.chat_generation_contexts (
  message_id uuid primary key references public.chat_messages (id) on delete cascade,
  context jsonb not null check (jsonb_typeof(context) = 'object'),
  created_at timestamptz not null default now()
);

alter table public.chat_generation_contexts enable row level security;
revoke all on public.chat_generation_contexts from public, anon, authenticated;
grant select, insert, update, delete on public.chat_generation_contexts to service_role;
