import { profileContext, type Household } from "@magpie/profile";

import { ASSISTANT_SYSTEM_PROMPT } from "./assistant-prompt.js";
import { PLAN_PROMPT } from "./plan-prompt.js";

/**
 * The always-on guidance an MCP client gets at initialize / discover. Same
 * prompt and household brief as the app's chat, minus the chat-only pieces,
 * plus this client's rendering and the app-only tools it does not offer.
 */
export function mcpInstructions(
  household: Household | null,
  userId: string,
): string {
  return [
    ASSISTANT_SYSTEM_PROMPT,
    PLAN_PROMPT,
    household ? profileContext(household, userId) : null,
    "## This client\nThis conversation is not inside the Magpie app: the app's `<ideas>` and `<sketch>` tags render literally here, so write ideas and sketches as ordinary Markdown, using headings, short paragraphs and lists. The `updateRecipe` tool is not available here; save a requested change with `addToCookbook` as a new recipe. The `addMealShoppingItems` tool is not available here; shopping for a planned meal is added in Magpie, not in this conversation.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
