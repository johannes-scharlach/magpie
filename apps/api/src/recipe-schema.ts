import { efforts } from "@magpie/meals";
import { z } from "zod";

import { equipmentIds, recipeCuisineIds } from "./recipe-tags.js";

/**
 * One recipe shape for every way a variant gets written: URL import, the
 * cook's addToCookbook / updateRecipe tools. The zod descriptions double as
 * the model's instructions, so keep them precise.
 */
export const locales = ["en", "de"] as const;
export type Locale = (typeof locales)[number];
export const localeNames: Record<Locale, string> = {
  en: "English",
  de: "German",
};

export const CATEGORIES = [
  "produce",
  "bakery",
  "deli",
  "dairy",
  "meat",
  "breakfast",
  "grains",
  "spices",
  "snacks",
  "frozen",
  "beverages",
  "care",
  "household",
  "pets",
  "home",
  "other",
] as const;
export type CategoryId = (typeof CATEGORIES)[number];

const prepNoteDescription =
  "Optional state clarifying the measured or purchased item (e.g. 'drained', 'thawed and squeezed dry'), never part of item_name. When importing, keep source ingredient-line prep here and leave step prep in instructions. When creating, put cutting and prep in the steps where used. Omit when none; never write 'none' or 'N/A'.";

const SwapSchema = z.object({
  qty_text: z
    .string()
    .nullable()
    .describe(
      'swap amount, e.g. "1 jar", "200g", or natural count plus weight like "2 carrots, about 200g"; null if none',
    ),
  item_name: z
    .string()
    .min(1)
    .describe(
      'swap ingredient name without prep, e.g. "couscous", "canned tuna in olive oil"',
    ),
  prep_note: z.string().optional().describe(prepNoteDescription),
  category_id: z
    .enum(CATEGORIES)
    .optional()
    .describe(
      "REQUIRED: aisle where you BUY the raw item (ignore prep). Omit ONLY for non-purchasable like leftovers.",
    ),
  reason: z
    .string()
    .min(1)
    .optional()
    .describe(
      "One short line in the recipe's language saying why a cook would pick this over the original: '15 min faster, no roasting', 'fennel-spiced if you pass an Italian deli', 'richer and more savoury'. Omit when no honest reason applies.",
    ),
});

const IngredientLineSchema = z.object({
  id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "When rewriting a saved variant, preserve the ingredient's id even when swapping, scaling or changing preparation. Omit id for a genuinely new ingredient or a new recipe; the server allocates it. Never recycle an id from a removed ingredient.",
    ),
  qty_text: z
    .string()
    .nullable()
    .describe(
      'amount with unit, e.g. "150g", "1-2 tins", "1/2 tsp", or natural count plus weight like "2 carrots, about 200g" or "2 portions, about 350g"; null if none like "Freshly ground black pepper"',
    ),
  item_name: z
    .string()
    .min(1)
    .describe(
      'ingredient name WITHOUT quantity or prep, e.g. "bulgur", "sardines in olive oil", "garlic". Keep purchase distinctions such as "canned tomatoes", "frozen spinach", or "coarse bulgur" in the name.',
    ),
  prep_note: z.string().optional().describe(prepNoteDescription),
  category_id: z
    .enum(CATEGORIES)
    .optional()
    .describe(
      "REQUIRED: aisle where you BUY the raw item before prepping (produce/bakery/deli/dairy/meat/breakfast/grains/spices/snacks/frozen/beverages/care/household/pets/home/other). Ignore prep_note when picking. Omit ONLY for non-purchasable like leftovers. Use most specific aisle, 'other' only as last resort.",
    ),
  shopping_hint: z
    .enum(["check_at_home", "likely_purchase"])
    .optional()
    .describe(
      "REQUIRED for new recipes: check_at_home only for everyday cooking basics that a household might already have, such as small amounts of salt, oil, water, or common dried seasonings; otherwise likely_purchase. This is a shopping-review suggestion, not a claim about actual inventory. Judge the ingredient in context, not by its supermarket aisle. Older recipes may omit this field; they default to likely_purchase.",
    ),
  swaps: z
    .array(SwapSchema)
    .optional()
    .describe(
      "Alternatives discussed in the conversation, plus 1-2 purposeful swaps for future cooks, each for a distinct reason: " +
        "(1) Faster/easier: a shortcut form that saves real work and says how much (fresh bell pepper -> jarred roasted peppers, '15 min faster, no roasting'; dried -> canned chickpeas, 'skips soaking and simmering'). " +
        "(2) Good alternative: another vegetable, protein, or base that cooks well in THIS dish and changes it meaningfully — not a trivial near-synonym (white cabbage -> savoy cabbage or green beans, not pointed cabbage; canned tuna -> sardines, 'richer and more savoury'; bulgur -> couscous, 'cooks in 5 min'). " +
        "(3) Specialty upgrade or everyday fallback: e.g. when the recipe uses Bratwurst for an everyday supermarket Gnocchi skillet, offer salsiccia ('fennel-spiced if you pass a butcher or Italian deli'), or vice versa. " +
        "Every swap needs a distinct item_name (never just a brand or grade of the same thing), its own qty_text and category_id, and a short reason. Omit when no worthwhile swap applies.",
    ),
  without: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Short imperative label for skipping a non-essential ingredient, naming its role in THIS dish: 'Skip the garnish', 'Leave out the heat', 'Skip the cheese crust' (or 'Leave out the anchovies' when it has no smaller role). Offer whenever the dish still cooks well without this line; when importing, give it to every line marked optional and keep 'optional' out of item_name and prep_note.",
    ),
});

const StepIngredientSchema = z.object({
  qty_text: z
    .string()
    .nullable()
    .describe(
      'the amount this step uses, e.g. "150g", "1/2". When an ingredient line is split across steps (150g butter for the batter, 75g for the glaze), each step gets only its share. null if none, like "salt to taste"',
    ),
  item_name: z
    .string()
    .min(1)
    .describe("the item_name of the ingredient line this comes from"),
  prep_note: z
    .string()
    .optional()
    .describe(
      "how this portion should be prepped when the cook reaches this step, e.g. 'juiced', 'softened', 'finely diced'. Omit when none; never write placeholders such as 'none' or 'N/A'.",
    ),
});

export const RecipeSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe('the full recipe name, e.g. "Chicken Traybake"'),
  description: z
    .string()
    .min(1)
    .describe("a short, appetizing summary of the dish"),
  locale: z
    .enum(locales)
    .describe(
      "the short language code (en or de), without a regional variant; match the language used in the recipe",
    ),
  totalTime: z
    .string()
    .min(1)
    .describe(
      'wall-clock time from the first thing the cook does until the food is ready. Account for parallel work; do not add every step duration together. Examples: "45 minutes", "1 hour 20 minutes"',
    ),
  recipeYield: z
    .string()
    .min(1)
    .describe(
      'who the recipe feeds, e.g. "4 servings" or "2 adults and 2 kids". Decide the yield first and make every ingredient quantity fit it.',
    ),
  contentMarkdown: z
    .string()
    .optional()
    .describe(
      "Use only for useful, recipe-specific context that has no dedicated field, such as toddler tasks, the vibe, serving ideas, or adaptations. Do not include ingredients or step-by-step instructions; those belong in recipeIngredient and recipeInstructions. Omit when there is no useful extra context.",
    ),
  recipeIngredient: z
    .array(IngredientLineSchema)
    .min(1)
    .describe(
      "REQUIRED structured ingredient lines, one per ingredient, with quantity, ingredient name, shopping category, and embedded 1:1 swaps when useful. This is required even when ingredient details also appear in the source text.",
    ),
  recipeInstructions: z
    .array(
      z.object({
        name: z
          .string()
          .min(1)
          .describe(
            'a crisp, short title for the cooking action, e.g. "Marinate the tofu"',
          ),
        ingredients: z
          .array(StepIngredientSchema)
          .describe(
            "the measured ingredients used in this step. Include only ingredients used together in this step.",
          ),
        text: z
          .string()
          .min(1)
          .describe("clear, detailed instructions for this cooking action"),
        tip: z
          .string()
          .optional()
          .describe("an actionable cook-specific tip; omit if none adds value"),
      }),
    )
    .describe(
      "ordered cooking steps. Keep each step to an action in one place; give concurrent jobs separate steps and say what each runs alongside. There is no minimum or maximum number of steps, so a simple recipe can have as few as one step and a complex recipe can have many.",
    ),
  recipeCuisine: z
    .string()
    .min(1)
    .describe(
      `REQUIRED: the one cuisine the dish comes from or is closest to. Use one of these ids when it fits: ${recipeCuisineIds.join(", ")}. A regional style of one of them takes its id: Sicilian is italian. Otherwise use the household's own cuisine word when given, and only then a short name of your own.`,
    ),
  tags: z
    .array(z.string().min(1))
    .describe(
      'one or two short tags in the recipe\'s language for what kind of dish this is, the way a cook would name it: pasta pomodoro is "pasta", a pasta bake is "pasta" and "bake", Flammkuchen is "flatbread". Plus as many of the household\'s tags as fit well, such as their "no meat" on a dish without meat. Name what the dish is, never what it resembles. A cook finds similar dishes by them, so reuse a household tag that means the same rather than adding a synonym: if they say "bake", do not add "casserole". Never repeat the cuisine, the equipment or the effort as a tag.',
    ),
  equipment: z
    .array(z.string().min(1))
    .describe(
      `the appliances this version needs. Use these ids when they fit: ${equipmentIds.join(", ")}. Otherwise use the household's own equipment word when given, such as "sous vide" or "grill", and only then a short name of your own. Leave out pots, pans and knives.`,
    ),
  effort: z
    .enum(efforts)
    .describe(
      'how much the dish asks of the cook, judged by its hands-on work, the pans and the cleanup. Judge the dish, not how the recipe is written: the same dish split into more, smaller steps takes the same effort. Not the total time either: a long unattended braise can be "easy". no-cooking: assembled without heat, such as a salad, overnight oats or burrata with peaches. easy: few ingredients and simple, familiar steps, even with a pot and a pan, such as pasta with tomato sauce, an omelette, a tray bake or a soup that simmers by itself. normal: some prep and a few parts to time together, such as a curry from scratch with plenty of chopping, a risotto stirred throughout, or burgers with sides. more-work: several components, techniques that need attention or many pans, such as fresh pasta, a lasagne with two sauces or a roast with sides. big-project: hours of work or several days, such as croissants or a cassoulet.',
    ),
  from: z
    .object({
      name: z.string().min(1).describe("source name"),
      url: z.url().optional().describe("source URL"),
    })
    .optional()
    .describe("provenance of the import"),
});

export type RecipeInput = z.infer<typeof RecipeSchema>;

/** A recipe the assistant or the adjust route writes: provenance is ours. */
export const CookRecipeSchema = RecipeSchema.omit({ from: true });
export type CookRecipeInput = z.infer<typeof CookRecipeSchema>;

export const SizedForSchema = z.object({
  eater_ids: z
    .array(z.uuid())
    .describe("household person IDs this recipe was actually sized for"),
  extra_portions: z
    .number()
    .min(0)
    .multipleOf(0.01)
    .describe("extra adult portions beyond the named eaters; use 0 for none"),
  total_target_kcal: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "The total approximate calorie target this variant was actually written for, including extra food. Copy the app-resolved target from getMealSizing; never infer a missing historical target from current household settings. This is a cooking target, not verified nutrition. Omit for treats, meal components or unknown sizing.",
    ),
});

/** A new cookbook recipe can record the household sizing used to write it. */
export const AddToCookbookSchema = CookRecipeSchema.extend({
  sizedFor: SizedForSchema.optional().describe(
    "Include only when the recipe was actually sized for specific household people and extra portions. Use their IDs from the household context; omit if the sizing is not known.",
  ),
});
