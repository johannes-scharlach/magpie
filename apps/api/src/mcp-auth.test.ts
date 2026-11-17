import assert from "node:assert/strict";
import { test } from "node:test";

import {
  mcpOriginAllowed,
  protectedResourceMetadata,
  publicOrigin,
  resourceMetadataUrl,
  wwwAuthenticate,
} from "./mcp-auth.js";

test("protected resource metadata points at the Supabase auth issuer", () => {
  assert.deepEqual(
    protectedResourceMetadata({
      origin: "https://magpie.example",
      supabaseUrl: "https://abc.supabase.co/",
    }),
    {
      resource: "https://magpie.example/mcp",
      authorization_servers: ["https://abc.supabase.co/auth/v1"],
      bearer_methods_supported: ["header"],
      resource_name: "Magpie",
    },
  );
});

test("the 401 challenge advertises the metadata document", () => {
  assert.equal(
    resourceMetadataUrl("https://magpie.example"),
    "https://magpie.example/.well-known/oauth-protected-resource",
  );
  assert.equal(
    wwwAuthenticate("https://magpie.example"),
    'Bearer resource_metadata="https://magpie.example/.well-known/oauth-protected-resource"',
  );
});

test("a configured origin wins over the request origin", () => {
  assert.equal(
    publicOrigin("http://localhost:8787/mcp", "https://magpie.example/"),
    "https://magpie.example",
  );
  assert.equal(
    publicOrigin("http://localhost:8787/mcp", null),
    "http://localhost:8787",
  );
});

test("chat hosts and localhost may call /mcp, a foreign site may not", () => {
  assert.equal(mcpOriginAllowed(undefined), true);
  assert.equal(mcpOriginAllowed("https://chatgpt.com"), true);
  assert.equal(mcpOriginAllowed("https://chat.openai.com"), true);
  assert.equal(mcpOriginAllowed("https://claude.ai"), true);
  assert.equal(mcpOriginAllowed("http://localhost:6274"), true);
  assert.equal(mcpOriginAllowed("http://127.0.0.1:6274"), true);
  assert.equal(mcpOriginAllowed("https://evil.example"), false);
  assert.equal(mcpOriginAllowed("http://chatgpt.com"), false);
});
