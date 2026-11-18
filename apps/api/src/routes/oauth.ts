import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { z } from "zod";

import { type AppBindings, requireUser } from "../auth.js";
import { consentCsp, renderConsentPage } from "../consent-page.js";
import { pool } from "../db.js";
import { env } from "../env.js";
import { AppError } from "../errors.js";
import { protectedResourceMetadata, publicOrigin } from "../mcp-auth.js";

export const oauth = new Hono<AppBindings>();

/**
 * RFC 9728: where the MCP client learns which authorization server to use.
 * Public and cacheable; it names the Supabase project that signs the tokens.
 */
oauth.get("/.well-known/oauth-protected-resource", (c) => {
  const origin = publicOrigin(c.req.url, env.publicOrigin);
  return c.json(
    protectedResourceMetadata({ origin, supabaseUrl: env.supabaseUrl }),
    200,
    { "cache-control": "public, max-age=300" },
  );
});

/** Supabase redirects here with `authorization_id`; see consent-page.ts. */
oauth.get("/oauth/consent", (c) => {
  if (!env.supabasePublishableKey)
    return c.text("OAuth is not configured.", 503);
  const nonce = randomUUID();
  return c.html(
    renderConsentPage({
      supabaseUrl: env.supabaseUrl,
      publishableKey: env.supabasePublishableKey,
      nonce,
    }),
    200,
    {
      "content-security-policy": consentCsp(env.supabaseUrl, nonce),
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-frame-options": "DENY",
    },
  );
});

// Same-origin calls from the consent page, after it verified the email code.
// Keep requireUser as the anchor: the page sends the Supabase access token.
oauth.use("/oauth/households", requireUser);
oauth.use("/oauth/household", requireUser);

/**
 * The households the consent page may offer: memberships that have a profile,
 * matching what the app can show. `selected` is only reported while it is
 * still one of them, so a stale choice never preselects a missing household.
 */
oauth.get("/oauth/households", async (c) => {
  const { rows } = await pool.query<{
    id: string;
    name: string;
    selected: boolean;
  }>(
    `SELECT l.id, l.name, h.list_id = l.id AS selected
     FROM list_members m
     JOIN lists l ON l.id = m.list_id
     JOIN household_profiles p ON p.id = l.id
     LEFT JOIN mcp_households h ON h.user_id = m.user_id AND h.list_id = l.id
     WHERE m.user_id = $1
     ORDER BY l.created_at, l.id`,
    [c.get("user").id],
  );
  const households = rows.map(({ id, name }) => ({ id, name }));
  return c.json({
    households,
    selected: rows.find((row) => row.selected)?.id ?? null,
  });
});

const HouseholdChoice = z.object({ listId: z.uuid() });

/** Persist the consent page's choice before the authorization is approved. */
oauth.put("/oauth/household", async (c) => {
  const parsed = HouseholdChoice.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success)
    throw new AppError("INVALID_REQUEST", "Choose a household.", 400);

  const userId = c.get("user").id;
  const { listId } = parsed.data;
  const membership = await pool.query(
    `SELECT 1
     FROM list_members m
     JOIN household_profiles p ON p.id = m.list_id
     WHERE m.user_id = $1 AND m.list_id = $2`,
    [userId, listId],
  );
  if (!membership.rowCount)
    throw new AppError(
      "HOUSEHOLD_ACCESS_DENIED",
      "Choose one of your households.",
      403,
    );

  await pool.query(
    `INSERT INTO mcp_households (user_id, list_id, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE
       SET list_id = excluded.list_id, updated_at = excluded.updated_at`,
    [userId, listId],
  );
  return c.json({ listId });
});
