-- What a dish is belongs to the recipe; how a version is made belongs to the
-- variant (ADR 36). Cuisine and tags move to recipes, and variants record the
-- equipment they need. variants.tags from 20261028120000 never shipped in an
-- app, so it goes; variants.recipe_cuisine stays for installed apps.
alter table public.recipes
  add column cuisine text,
  add column tags jsonb not null default '[]'::jsonb
    check (jsonb_typeof(tags) = 'array');

alter table public.variants
  drop column tags,
  add column equipment jsonb not null default '[]'::jsonb
    check (jsonb_typeof(equipment) = 'array');

-- Same as 20261028120000, copying the recipe's tags and the variant's equipment.
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
  insert into public.recipes (id, list_id, from_name, from_url, next_ingredient_id, cuisine, tags)
    select copy_recipe_id, target_list_id, r.from_name, r.from_url, r.next_ingredient_id,
      r.cuisine, r.tags
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
