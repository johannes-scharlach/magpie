import assert from "node:assert/strict";
import { test } from "node:test";

import { fetchGeminiShare, isGeminiShare } from "./gemini-share.js";

const short = "https://share.gemini.google/shortId";
const canonical = "https://gemini.google.com/share/conversationId";

test("a Gemini short link resolves to a conversation whose recipe reaches the importer", async () => {
  const messages = [
    [
      null,
      null,
      [["Can you give me a recipe for oat cookies?"]],
      [[["replyId", ["Oat cookies\nIngredients: 100 g oats\nBake at 180°C."]]]],
    ],
    [null, null, [["Thanks!"]], null, ["Internal metadata, not a message"]],
  ];
  const payload = JSON.stringify([[null, messages]]);
  const frame = JSON.stringify([["wrb.fr", "ujx1Bf", payload]]);
  const body = `)]}'\n\n${Buffer.byteLength(frame)}\n${frame}\n`;
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push(url.href);
    assert.equal(init?.redirect, "manual");
    if (url.href === short) return Response.redirect(canonical, 301);
    assert.equal(url.origin, "https://gemini.google.com");
    assert.equal(url.searchParams.get("rpcids"), "ujx1Bf");
    assert.equal(init?.method, "POST");
    assert.match(String(init?.body), /conversationId/);
    assert.doesNotMatch(String(init?.body), /shortId/);
    return new Response(body);
  };

  assert.equal(isGeminiShare(short), true);
  assert.equal(isGeminiShare(canonical), true);
  const transcript =
    "User: Can you give me a recipe for oat cookies?\n\n" +
    "Gemini: Oat cookies\nIngredients: 100 g oats\nBake at 180°C.\n\n" +
    "User: Thanks!";
  assert.equal(await fetchGeminiShare(short, fetcher), transcript);
  assert.equal(calls.length, 2);
  calls.length = 0;
  assert.equal(await fetchGeminiShare(canonical, fetcher), transcript);
  assert.equal(calls.length, 1);
});

test("a Gemini short link cannot send the importer to another origin", async () => {
  assert.equal(
    isGeminiShare("https://gemini.google.com.example/share/id"),
    false,
  );
  assert.equal(isGeminiShare("https://gemini.google.com/app/id"), false);
  const calls: string[] = [];
  await assert.rejects(
    fetchGeminiShare(short, async (input) => {
      calls.push(String(input));
      return Response.redirect("https://example.com/share/id", 301);
    }),
    { code: "RECIPE_PAGE_UNAVAILABLE" },
  );
  assert.deepEqual(calls, [short]);
});

test("an unavailable Gemini conversation suggests pasting the recipe text", async () => {
  await assert.rejects(
    fetchGeminiShare(
      canonical,
      async () => new Response(`)]}'\n\n26\n[["wrb.fr","ujx1Bf",null]]\n`),
    ),
    {
      code: "RECIPE_PAGE_UNAVAILABLE",
      message: /paste the recipe text/i,
    },
  );
});
