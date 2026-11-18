import assert from "node:assert/strict";
import { test } from "node:test";

// `env.ts` reads these when `app.ts` is imported below.
process.env.SUPABASE_URL ??= "http://127.0.0.1:1";
process.env.GOOGLE_GENERATIVE_AI_API_KEY ??= "unused";
process.env.DATABASE_URL ??= "postgres://unused:unused@localhost/unused";

const { app } = await import("./app.js");

test("serves an adaptive SVG favicon with light and dark palettes", async () => {
  const res = await app.request("/favicon.svg");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /^image\/svg\+xml/);
  assert.equal(res.headers.get("cache-control"), "public, max-age=86400");

  const svg = await res.text();
  assert.match(svg, /<svg[^>]+viewBox="0 0 96 96"/);
  assert.match(svg, /#fbf8f4/i);
  assert.match(svg, /#492f40/i);
  assert.match(svg, /prefers-color-scheme:\s*dark/);
  assert.match(svg, /#201b1e/i);
  assert.match(svg, /#ebc7b3/i);
});

test("serves a multi-size ICO favicon without authentication", async () => {
  const res = await app.request("/favicon.ico");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/x-icon");
  assert.equal(res.headers.get("cache-control"), "public, max-age=86400");

  const buf = Buffer.from(await res.arrayBuffer());
  // ICONDIR: reserved=0, type=1, count=3 (16, 32, 48)
  assert.equal(buf.readUInt16LE(0), 0);
  assert.equal(buf.readUInt16LE(2), 1);
  assert.equal(buf.readUInt16LE(4), 3);
  assert.deepEqual(
    [buf.readUInt8(6), buf.readUInt8(22), buf.readUInt8(38)],
    [16, 32, 48],
  );
});

test("serves a 180x180 PNG apple-touch-icon", async () => {
  const res = await app.request("/apple-touch-icon.png");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/png");
  assert.equal(res.headers.get("cache-control"), "public, max-age=86400");

  const buf = Buffer.from(await res.arrayBuffer());
  assert.deepEqual(
    buf.subarray(0, 8),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  // PNG IHDR width & height sit at bytes 16..24.
  assert.equal(buf.readUInt32BE(16), 180);
  assert.equal(buf.readUInt32BE(20), 180);
});
