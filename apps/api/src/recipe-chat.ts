import type { UIMessage } from "ai";
import { z } from "zod";

export const RecipeContextSchema = z.object({
  variantId: z.uuid(),
  plannedMealId: z.uuid().optional(),
  previewSwaps: z
    .record(z.string().regex(/^\d+$/), z.number().int().min(0))
    .optional(),
});

export const MealContextSchema = z.object({ plannedMealId: z.uuid() });

/** How a chat started from Home; its saved recipes carry it as origin (spec 0011). */
export const ChatEntrySchema = z.enum(["on_hand", "dish", "idea"]);
export type ChatEntry = z.infer<typeof ChatEntrySchema>;

export type RecipeChat = {
  list_id: string;
  recipe_id: string | null;
  initial_variant_id: string | null;
  planned_meal_id: string | null;
  initial_meal_content_id?: string | null;
  entry?: ChatEntry | null;
};

/** An actual server read, recorded in the same format as later tool reads.
 * It precedes the first user message and stays a historical snapshot. */
export function recipeSeed(
  id: string,
  reads: { tool: string; input: unknown; output: unknown }[],
): UIMessage {
  return {
    id,
    role: "assistant",
    parts: reads.map((read, index) => ({
      type: `tool-${read.tool}`,
      toolCallId: `${id}-${index}`,
      state: "output-available",
      input: read.input,
      output: read.output,
    })),
  };
}

export function recipeChatPrompt(chat: RecipeChat): string | null {
  if (!chat.recipe_id && chat.planned_meal_id) {
    return `## This meal conversation
Associated planned meal: ${chat.planned_meal_id} (a written-in meal on the calendar; it does not need a recipe).
Read it first with readPlannedMeal for its name, date, eaters, extra portions and shopping items. Help with cooking logistics or partial prep (such as a side salad for leftover lasagne), and call addMealShoppingItems only when the user asks to add shopping items.`;
  }
  if (!chat.recipe_id) return null;
  return `## This recipe conversation
Recipe group: ${chat.recipe_id}. Starting variant: ${chat.initial_variant_id ?? "no longer available"}.
${chat.planned_meal_id ? `Associated planned meal: ${chat.planned_meal_id}. Read it with readPlannedMeal before rewriting to get current eaters, extra portions, ingredientChoices and bought items.` : "This conversation has no associated planned meal."}
Read the starting variant first with readVariant (and searchVariants if exploring versions).
- **Resizing:** the variant's sizedFor.totalTargetKcal is the historical target when written; never recompute it from current settings. When resizing a whole lunch or dinner, compute the new total_target_kcal from the selected eaters' lunch_dinner_target_kcal in the household profile plus 600 * extra_portions, scale from the old target (or stated yield/quantities if missing) to the new target across the whole meal, and pass the new sizedFor to updateRecipe. Omit sizedFor when quantities are unchanged or for treats/components.
- **Rewriting:** use updateRecipe to save changes under this recipe (preserving continuing ingredient ids and folding in the meal's ingredientChoices by chosen item_name, not purchase snapshots). Never call planMeal on this conversation's associated meal—updateRecipe repoints the meal and updates unbought shopping items automatically without resetting the shopping list. Briefly report the returned meal and shopping changes.`;
}

function isRecipeSeed(message: { role: string; parts: unknown }): boolean {
  return (
    message.role === "assistant" &&
    Array.isArray(message.parts) &&
    message.parts.some(
      (part) =>
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        ((part as { type: unknown }).type === "tool-readVariant" ||
          (part as { type: unknown }).type === "tool-readPlannedMeal"),
    )
  );
}

/** Chats created by the first implementation persisted the synthetic read
 * before the initiating user. Repair their model history in memory so retrying
 * that same turn works; correctly ordered and ordinary histories are unchanged. */
export function orderRecipeSeed<T extends { role: string; parts: unknown }>(
  messages: T[],
): T[] {
  const seedIndex = messages.findIndex(isRecipeSeed);
  if (seedIndex < 0) return messages;
  const userIndex = messages.findIndex((message) => message.role === "user");
  if (userIndex < 0 || seedIndex === userIndex + 1) return messages;
  const next = [...messages];
  const [seed] = next.splice(seedIndex, 1);
  if (!seed) return messages;
  const firstUser = next.findIndex((message) => message.role === "user");
  next.splice(firstUser + 1, 0, seed);
  return next;
}
