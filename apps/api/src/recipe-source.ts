import type { RecipeInput } from "./recipe-schema.js";

type Source = NonNullable<RecipeInput["from"]>;

/** The author gets credit and a link: the link is a fact we hold, not model
 *  output. A photo has no link, so it credits whoever the photo names. */
export function importSource(
  url: string | undefined,
  fromModel: Source | undefined,
): Source | undefined {
  if (!url) return fromModel?.name ? { name: fromModel.name } : undefined;
  return {
    name: fromModel?.name || new URL(url).hostname.replace(/^www\./, ""),
    url,
  };
}
