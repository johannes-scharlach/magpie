import { z } from "zod";
import { measurementContext, type Measurements } from "@magpie/profile";

import { AppError } from "./errors.js";
import { tagVocabularyContext, type TagVocabulary } from "./recipe-tags.js";
import {
  CATEGORIES,
  localeNames,
  RecipeSchema,
  type Locale,
} from "./recipe-schema.js";

type Extraction = z.infer<typeof RecipeSchema>;

const SourceReferenceSchema = z
  .string()
  .min(1)
  .nullable()
  .describe(
    'where this recipe appears in the supplied content, as a short label in the recipe language. Prefer visible printed page numbers or explicit page markers in pasted text, e.g. "Page 37" or "Pages 37–38". Otherwise use the supplied photo labels, e.g. "Photo 2" or "Photos 2–3". Use null for text with no page markers. Never guess page numbers or cite a missing page as the source.',
  );

/** Pasted text or photos can hold several recipes, or part of one. */
export const RecipesFoundSchema = z.object({
  recipes: z
    .array(RecipeSchema.extend({ sourceReference: SourceReferenceSchema }))
    .describe("every complete recipe in the content, in page order"),
  skipped: z
    .array(
      z.object({
        name: z.string().min(1).describe("the recipe's name, as printed"),
        sourceReference: SourceReferenceSchema,
        reason: z
          .string()
          .min(1)
          .describe(
            'one short sentence for the cook: what is missing and what would help, e.g. "The steps continue on page 38. Add a photo of it."',
          ),
      }),
    )
    .describe(
      "recipes that are only partly there, such as cut off at the edge of a photo. Never complete them by guessing.",
    ),
});
export type RecipesFound = z.infer<typeof RecipesFoundSchema>;

/** The recipe the model read, or an error carrying its reason for the cook.
 *  A refusal, such as Google's RECITATION filter, gives no reason to show. */
export function extractedRecipe(
  result: { finishReason: string; rawFinishReason?: string; output: unknown },
  fallback: string,
): Extraction {
  if (result.finishReason !== "stop") {
    const reason = `Finish reason ${result.rawFinishReason ?? result.finishReason}`;
    throw extractionFailed(fallback, reason);
  }
  const output = result.output as Extraction | { error: string } | undefined;
  if (!output) throw extractionFailed(fallback, "No structured output");
  if ("error" in output) throw extractionFailed(output.error, output.error);
  return output;
}

/** Exactly one complete recipe saves at once. Anything more, or a recipe
 *  only partly there, waits for the cook to choose (ADR 35). */
export function extractedRecipes(
  result: { finishReason: string; rawFinishReason?: string; output: unknown },
  fallback: string,
): { save: Extraction } | { review: RecipesFound } {
  if (result.finishReason !== "stop") {
    const reason = `Finish reason ${result.rawFinishReason ?? result.finishReason}`;
    throw extractionFailed(fallback, reason);
  }
  const output = result.output as RecipesFound | { error: string } | undefined;
  if (!output) throw extractionFailed(fallback, "No structured output");
  if ("error" in output) throw extractionFailed(output.error, output.error);
  const { recipes, skipped } = output;
  if (recipes.length === 0) {
    const reason = skipped[0]?.reason ?? fallback;
    throw extractionFailed(reason, reason);
  }
  if (recipes.length === 1 && skipped.length === 0)
    return { save: recipes[0]! };
  return { review: output };
}

function extractionFailed(message: string, reason: string) {
  return new AppError("RECIPE_EXTRACTION_FAILED", message, 422, {
    cause: reason,
  });
}

export function respond(locale: Locale) {
  return `Respond with the extracted recipe in JSON format according to the provided schema. If you cannot extract a usable recipe, respond with {"error": "…"}: one or two short sentences in ${localeNames[locale]} telling the cook what you could not read and what would help, such as "The amounts are cut off. Take a photo of the whole ingredient list." or "This page has no recipe on it."`;
}

export function respondWithRecipes(locale: Locale) {
  return `Respond in JSON format according to the provided schema. If the content holds no recipe at all, respond with {"error": "…"}: one or two short sentences in ${localeNames[locale]} telling the cook what would help, such as "This page has no recipe on it."`;
}

export function extractionInstructions(
  locale: Locale,
  measurements?: Measurements,
  vocabulary?: TagVocabulary,
) {
  const units = measurements?.convert_imports
    ? `Convert measurements to the household's chosen units. ${measurementContext(measurements)} Return only the converted measurements. Do not retain source measurements in parentheses, notes, extra fields or a separate original variant.`
    : "Keep source amounts and temperatures exactly as given; do not convert units.";
  return (
    `Put every ingredient in recipeIngredient and all ordered cooking steps in recipeInstructions. Use contentMarkdown only for useful recipe-specific context that has no dedicated field, such as serving ideas, adaptations, equipment notes, or other contextual sections from the source. Do not repeat ingredients or step-by-step instructions in contentMarkdown; omit it if there is no useful extra context. Preserve ingredients, proportions, times and doneness cues. ${units} Write all prose (steps, tips, notes) in your own words; never copy the source's sentences. Write the recipe in ${localeNames[locale]} and set the \`locale\` field to "${locale}".` +
    `\n\nFor recipeIngredient, return an array of {qty_text, item_name, prep_note, category_id, shopping_hint, swaps, without} objects:` +
    `\n- qty_text: amount with unit (e.g. "150g", "1-2 tins", "1/2 tsp", null if none like "Freshly ground black pepper").` +
    `\n- item_name: ingredient name WITHOUT qty or preparation actions (e.g. "garlic" not "1 clove garlic thinly sliced"). Keep purchase distinctions from the source, such as "canned tomatoes", "frozen spinach", or "medium or coarse bulgur", in the name.` +
    `\n- prep_note: preserve preparation details from the source ingredient line here (e.g. "thinly sliced", "rough-chopped", "drained"). Leave preparation in the source instructions in recipeInstructions; do not move or duplicate it into ingredient lines. Omit prep_note when absent; never write placeholders such as "none" or "N/A". Preserve the source's preparation details and where they appear, even when it repeats them in both ingredients and instructions.` +
    `\n- category_id: REQUIRED for every purchasable ingredient — the supermarket aisle where you BUY the raw item BEFORE prepping. Must be one of ${CATEGORIES.join(",")}. Choose the most specific: garlic/lemon/herbs=produce, bulgur/pasta/rice=grains, olives/olive oil/spices/canned tomatoes=spices, feta/parmesan/salami/tofu=deli, milk/butter/yogurt/cream=dairy, raw poultry/beef/fish=meat, coffee/oats/jam=breakfast. Ignore the prep when picking the aisle. "1 clove garlic, thinly sliced" is produce, not other. Only omit category_id for truly non-purchasable items like "leftovers". Use "other" only as last resort, not default.` +
    `\n- shopping_hint: REQUIRED for each ingredient. Choose check_at_home only when this is an everyday cooking basic the cook should check before buying (e.g. a little salt, oil, water or common dried seasoning). Otherwise use likely_purchase, including when unsure. This does not assert what the household owns; it is independent of the shopping aisle category_id.` +
    `\nFor swaps, follow the swaps schema description — it is the single source of those rules. The one extra rule here: when the source itself lists an alternative, keep it, and preserve the source's own prep note along with any reason the source gives for it.\nFor without, follow its schema description. The source's optional ingredients always get one.` +
    `\nFor from.name, credit the author: for a social media post, the creator's name or account, never the platform.` +
    (vocabulary ? `\n\n${tagVocabularyContext(vocabulary)}` : "")
  );
}
