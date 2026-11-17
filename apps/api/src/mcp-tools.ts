import type { Tool } from "ai";
import { z } from "zod";

import { buildChatTools } from "./chat-tools.js";

/**
 * Two chat tools are genuinely app-shaped and stay out of the plugin surface:
 * `addMealShoppingItems` needs a chat attached to a planned meal, and
 * `updateRecipe` derives its idempotent variant id from a chat turn. The
 * 2026 MCP core is stateless, so there is no stable per-turn id to key on.
 */
const APP_ONLY_TOOLS = new Set(["addMealShoppingItems", "updateRecipe"]);

const READ_ONLY_TOOLS = new Set([
  "getMealSizing",
  "searchVariants",
  "readVariant",
  "readPlannedMeal",
  "readPlan",
  "searchSavedRecipes",
  "readCookbookOverview",
]);

type McpAnnotations = { readOnlyHint?: boolean; destructiveHint?: boolean };

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  annotations?: McpAnnotations;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
};

function annotationsFor(name: string): McpAnnotations | undefined {
  if (READ_ONLY_TOOLS.has(name)) return { readOnlyHint: true };
  if (name === "unplanMeal") return { destructiveHint: true };
  return undefined;
}

function zodSchemaOf(tool: Tool): z.ZodType {
  if (tool.inputSchema instanceof z.ZodType) return tool.inputSchema;
  throw new Error("Chat tools must expose a Zod input schema");
}

/**
 * The MCP tool list derives from the same chat tools the app uses. A
 * synthetic chat with no recipe, meal or entry satisfies the ten tools that
 * need only the user, the household and today; ADR 39 keeps the other two
 * out until the protocol has what they need.
 */
export function buildMcpTools(
  userId: string,
  listId: string,
  today: string,
): McpToolDefinition[] {
  const tools = buildChatTools(userId, listId, {
    chatId: "",
    messageId: "",
    today,
    chat: {
      list_id: listId,
      recipe_id: null,
      initial_variant_id: null,
      planned_meal_id: null,
    },
  });

  return Object.entries(tools)
    .filter(([name]) => !APP_ONLY_TOOLS.has(name))
    .map(([name, definition]) => {
      const execute = definition.execute;
      if (!execute) throw new Error(`Chat tool ${name} has no execute`);
      const run = execute as unknown as (
        input: Record<string, unknown>,
        options: { toolCallId: string; messages: [] },
      ) => Promise<unknown>;
      return {
        name,
        description:
          typeof definition.description === "string"
            ? definition.description
            : "",
        inputSchema: zodSchemaOf(definition),
        annotations: annotationsFor(name),
        execute: (input) =>
          run(input, {
            toolCallId: name,
            messages: [],
          }),
      };
    });
}
