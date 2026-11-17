const CHAT_ORIGINS = new Set([
  "https://chatgpt.com",
  "https://chat.openai.com",
  "https://platform.openai.com",
  "https://claude.ai",
]);

const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/** Browser origins that may call `/mcp`. A missing Origin is a server client. */
export function mcpOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  return CHAT_ORIGINS.has(origin) || LOCAL_ORIGIN.test(origin);
}

export function publicOrigin(
  requestUrl: string,
  configured: string | null,
): string {
  return (configured || new URL(requestUrl).origin).replace(/\/+$/, "");
}

export function resourceMetadataUrl(origin: string): string {
  return `${origin}/.well-known/oauth-protected-resource`;
}

/** RFC 9728 metadata the MCP client reads after a 401. */
export function protectedResourceMetadata(opts: {
  origin: string;
  supabaseUrl: string;
}) {
  return {
    resource: `${opts.origin}/mcp`,
    authorization_servers: [`${opts.supabaseUrl.replace(/\/+$/, "")}/auth/v1`],
    bearer_methods_supported: ["header"],
    resource_name: "Magpie",
  };
}

export function wwwAuthenticate(origin: string): string {
  return `Bearer resource_metadata="${resourceMetadataUrl(origin)}"`;
}
