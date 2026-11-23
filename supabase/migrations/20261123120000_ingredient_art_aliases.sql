-- Global, server-only art cache. No household ids, quantities or notes.
-- Store a hash of the normalized label; only approved plain ingredient names
-- are retained in clear text as candidates for art generation.
create table public.ingredient_art_aliases (
  label_key text primary key check (label_key ~ '^[a-f0-9]{64}$'),
  art_id text,
  ingredient_name text,
  check (num_nonnulls(art_id, ingredient_name) = 1)
);

alter table public.ingredient_art_aliases enable row level security;
revoke all on public.ingredient_art_aliases from public, anon, authenticated;
