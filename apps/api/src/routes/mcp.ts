import {
  createMcpHandler,
  McpServer,
  type McpRequestContext,
} from "@modelcontextprotocol/server";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { AppBindings } from "../auth.js";
import { requireUser } from "../auth.js";
import { pool } from "../db.js";
import { env } from "../env.js";
import { AppError } from "../errors.js";
import { readHousehold } from "../household.js";
import {
  mcpOriginAllowed,
  publicOrigin,
  wwwAuthenticate,
} from "../mcp-auth.js";
import { mcpInstructions } from "../mcp-instructions.js";
import { buildMcpTools } from "../mcp-tools.js";

/**
 * `list_members` is many-to-many, so the endpoint needs one household per
 * request. The consent page stores an explicit choice; a sole household needs
 * no choice. Anything else refuses rather than guessing.
 */
export async function resolveListId(userId: string): Promise<string> {
  // A stored choice only counts while it is still one of the user's
  // profile-bearing households.
  const stored = await pool.query<{ list_id: string }>(
    `SELECT h.list_id
     FROM mcp_households h
     JOIN list_members m ON m.list_id = h.list_id AND m.user_id = h.user_id
     JOIN household_profiles p ON p.id = h.list_id
     WHERE h.user_id = $1`,
    [userId],
  );
  if (stored.rows[0]) return stored.rows[0].list_id;

  const members = await pool.query<{ list_id: string }>(
    `SELECT m.list_id
     FROM list_members m
     JOIN household_profiles p ON p.id = m.list_id
     WHERE m.user_id = $1
     ORDER BY m.joined_at, m.list_id`,
    [userId],
  );
  if (members.rows.length === 0)
    throw new AppError(
      "NO_HOUSEHOLD",
      "No household yet. Join or create one in Magpie first.",
      403,
    );
  if (members.rows.length > 1)
    throw new AppError(
      "CHOOSE_HOUSEHOLD",
      "You are in more than one household. Reconnect Magpie and choose one.",
      409,
    );
  return members.rows[0]!.list_id;
}

function identityOf(ctx: McpRequestContext): {
  userId: string;
  listId: string;
} {
  const extra = ctx.authInfo?.extra;
  if (typeof extra?.userId !== "string" || typeof extra?.listId !== "string")
    throw new Error("MCP request is missing its user and household");
  return { userId: extra.userId, listId: extra.listId };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * One handler for both protocol eras: the 2026 per-request envelope and the
 * 2025 stateless fallback construct the same server from the same tools.
 * `authInfo` is pass-through from the Hono route; the SDK never verifies a
 * token itself.
 */
export const mcpHandler = createMcpHandler(
  async (ctx) => {
    const { userId, listId } = identityOf(ctx);
    const household = await readHousehold(listId);
    const server = new McpServer(
      { name: "magpie", version: "0.1.0" },
      { instructions: mcpInstructions(household, userId) },
    );
    for (const tool of buildMcpTools(userId, listId, today())) {
      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: tool.annotations,
        },
        async (input) => {
          const result = await tool.execute(input as Record<string, unknown>);
          return {
            content: [{ type: "text", text: JSON.stringify(result) ?? "null" }],
          };
        },
      );
    }
    return server;
  },
  { legacy: "stateless" },
);

export const mcp = new Hono<AppBindings>();

// Outside /v1 on purpose: MCP has its own transport, but the auth anchor is
// the same Supabase access token every other route trusts. A 401 must carry
// the protected-resource metadata URL so the client can discover OAuth.
mcp.use("*", async (c, next) => {
  if (!mcpOriginAllowed(c.req.header("origin")))
    return c.json(
      { error: { code: "FORBIDDEN_ORIGIN", message: "Origin not allowed" } },
      403,
    );

  try {
    await requireUser(c, next);
  } catch (error) {
    if (error instanceof HTTPException && error.status === 401)
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        401,
        {
          "WWW-Authenticate": wwwAuthenticate(
            publicOrigin(c.req.url, env.publicOrigin),
          ),
        },
      );
    throw error;
  }
});
mcp.all("*", async (c) => {
  const user = c.get("user");
  const listId = await resolveListId(user.id);
  const authorization = c.req.header("authorization") ?? "";
  return mcpHandler.fetch(c.req.raw, {
    authInfo: {
      token: authorization.replace(/^Bearer\s+/i, ""),
      clientId: user.id,
      scopes: [],
      extra: { userId: user.id, listId },
    },
  });
});
