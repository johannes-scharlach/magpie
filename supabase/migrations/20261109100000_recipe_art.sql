-- Clay art for every recipe (ADR 38). The API draws it after a save and
-- uploads it with the service role; anyone with the path can read it.
-- Paths are <recipe_id>.webp. Null until the art arrives.
alter table public.recipes add column art_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-art', 'recipe-art', true, 1048576, array['image/webp'])
on conflict (id) do nothing;

-- Same as 20261028140000, and the copy shows the source's art.
create or replace function public.copy_variant(source_variant_id uuid, target_list_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  source public.variants;
  copy_recipe_id uuid := extensions.uuid_generate_v5(
    '6f9a1c2e-2b7a-5f3d-9c41-0e8b6d5a4f77',
    format('["recipe-copy","%s","%s"]', target_list_id, source_variant_id));
  copy_variant_id uuid := extensions.uuid_generate_v5(
    '6f9a1c2e-2b7a-5f3d-9c41-0e8b6d5a4f77',
    format('["variant-copy","%s","%s"]', target_list_id, source_variant_id));
begin
  select * into source from public.variants where id = source_variant_id;
  if source.id is null then
    raise exception 'Recipe not found' using errcode = 'P0002';
  end if;
  if source.list_id = target_list_id then
    return source.id;
  end if;
  insert into public.recipes (id, list_id, from_name, from_url, next_ingredient_id, cuisine, tags,
      art_path)
    select copy_recipe_id, target_list_id, r.from_name, r.from_url, r.next_ingredient_id,
      r.cuisine, r.tags, r.art_path
    from public.recipes r where r.id = source.recipe_id
    on conflict (id) do nothing;
  insert into public.variants (id, recipe_id, list_id, name, description, locale, total_time,
      recipe_yield, content_markdown, equipment, effort, ingredient_lines, instructions)
    values (copy_variant_id, copy_recipe_id, target_list_id, source.name, source.description,
      source.locale, source.total_time, source.recipe_yield, source.content_markdown,
      source.equipment, source.effort, source.ingredient_lines, source.instructions)
    on conflict (id) do nothing;
  return copy_variant_id;
end $$;

revoke execute on function public.copy_variant(uuid, uuid) from public, anon, authenticated;
