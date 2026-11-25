-- Global, server-only registry. Keep existing aliases pointing at the
-- ingredient name so all its translations resolve once the asset exists.
create table public.ingredient_art_assets (
  ingredient_name text primary key,
  art_id text not null unique check (art_id ~ '^generated-[a-f0-9]{64}$')
);

alter table public.ingredient_art_assets enable row level security;
revoke all on public.ingredient_art_assets from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ingredient-art', 'ingredient-art', true, 1048576, array['image/webp'])
on conflict (id) do nothing;
