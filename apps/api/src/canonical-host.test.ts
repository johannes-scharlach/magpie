import assert from "node:assert/strict";
import { test } from "node:test";

// `env.ts` reads this when the app is imported below, so the redirect target
// is the same one production configures.
process.env.SUPABASE_URL ??= "http://127.0.0.1:1";
process.env.GOOGLE_GENERATIVE_AI_API_KEY ??= "unused";
process.env.DATABASE_URL ??= "postgres://unused:unused@localhost/unused";
process.env.MAGPIE_PUBLIC_ORIGIN = "https://magpiemeals.com";

const { app } = await import("./app.js");

test("www redirects permanently to the canonical apex", async () => {
  const res = await app.request(
    "http://www.magpiemeals.com/r/secret-token?from=mail",
  );

  assert.equal(res.status, 301);
  assert.equal(
    res.headers.get("location"),
    "https://magpiemeals.com/r/secret-token?from=mail",
  );
});

test("the canonical apex is served, not redirected", async () => {
  const res = await app.request("https://magpiemeals.com/health");

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("location"), null);
  assert.deepEqual(await res.json(), { ok: true });
});

test("a www prefix on another domain is not redirected", async () => {
  const res = await app.request("https://www.magpiemeals.com.example/health");

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("location"), null);
});

test("a local request is not redirected", async () => {
  const res = await app.request("http://localhost:8787/health");

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("location"), null);
});
