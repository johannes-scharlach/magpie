import { randomUUID } from "node:crypto";

import { Hono } from "hono";

import { consentCsp, renderConsentPage } from "../consent-page.js";
import { env } from "../env.js";
import { protectedResourceMetadata, publicOrigin } from "../mcp-auth.js";

export const oauth = new Hono();

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
