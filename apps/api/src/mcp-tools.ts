import { profileContext } from "@magpie/profile";
import type { Tool } from "ai";
import { z } from "zod";

import { buildChatTools } from "./chat-tools.js";
import { readHousehold } from "./household.js";

/**
 * Two chat tools are genuinely app-shaped and stay out of the plugin surface:
 * `addMealShoppingItems` needs a chat attached to a planned meal, and
 * `updateRecipe` derives its idempotent variant id from a chat turn. The
 * 2026 MCP core is stateless, so there is no stable per-turn id to key on.
 */
const APP_ONLY_TOOLS = new Set(["addMealShoppingItems", "updateRecipe"]);

const READ_ONLY_TOOLS = new Set([
  "readHousehold",
  "searchVariants",
  "readVariant",
  "readPlannedMeal",
  "readPlan",
  "searchSavedRecipes",
  "readCookbookOverview",
]);

/**
 * Clients show `title`, not the camelCase tool name. Without it ChatGPT
 * renders names as one word ("Readhousehold"). OpenAI's plugin guidance asks
 * for a title on every tool.
 */
const TOOL_TITLES: Record<string, string> = {
  addToCookbook: "Save to cookbook",
  planMeal: "Plan a meal",
  readCookbookOverview: "Read cookbook overview",
  readHousehold: "Read household profile",
  readPlan: "Read the meal plan",
  readPlannedMeal: "Read a planned meal",
  readVariant: "Read a variant",
  searchSavedRecipes: "Search saved recipes",
  searchVariants: "Search recipe variants",
  unplanMeal: "Remove a planned meal",
};

type McpAnnotations = { readOnlyHint?: boolean; destructiveHint?: boolean };

export type McpToolDefinition = {
  name: string;
  title: string;
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

  const chatTools = Object.entries(tools)
    .filter(([name]) => !APP_ONLY_TOOLS.has(name))
    .map(([name, definition]): McpToolDefinition => {
      const execute = definition.execute;
      if (!execute) throw new Error(`Chat tool ${name} has no execute`);
      const run = execute as unknown as (
        input: Record<string, unknown>,
        options: { toolCallId: string; messages: [] },
      ) => Promise<unknown>;
      const title = TOOL_TITLES[name];
      if (!title) throw new Error(`MCP tool ${name} has no title`);
      return {
        name,
        title,
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

  return [
    {
      name: "readHousehold",
      title: TOOL_TITLES.readHousehold!,
      description:
        "Read the household's cooking profile: people, portion references, lunch/dinner calorie targets, meal attendance defaults (meals_at_home, meal_times), diets, allergies and avoidances, equipment, measurements, cuisines, kept staples, shop rules, and meal ideas brief. Read before suggesting meals, sizing portions, or answering about the household.",
      inputSchema: z.object({}),
      annotations: annotationsFor("readHousehold"),
      execute: async () => {
        const household = await readHousehold(listId);
        return {
          profileContext: household ? profileContext(household, userId) : null,
        };
      },
    },
    ...chatTools,
  ];
}
