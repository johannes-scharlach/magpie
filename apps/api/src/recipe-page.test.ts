import assert from "node:assert/strict";
import { test } from "node:test";

import {
  fetchRecipePage,
  geminiSeesOnlyAShell,
  isPublicAddress,
  recipePageText,
} from "./recipe-page.js";

test("only public addresses may be fetched", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.8",
    "172.20.1.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fdaa:0:1::3", // Fly's private network
    "fe80::1",
    "::ffff:127.0.0.1",
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  for (const address of ["8.8.8.8", "192.0.78.13", "2606:4700::6810:84e5"]) {
    assert.equal(isPublicAddress(address), true, address);
  }
});

test("private hosts and other schemes are refused before connecting", async () => {
  for (const url of [
    "http://127.0.0.1:9/",
    "http://localhost:9/",
    "http://[::1]:9/",
    "file:///etc/passwd",
  ]) {
    await assert.rejects(
      fetchRecipePage(url),
      { code: "RECIPE_PAGE_UNAVAILABLE", cause: /private address|Scheme/ },
      url,
    );
  }
});

const page = (body: string) =>
  `<html><head><title>Risotto</title><script>var ads = 1;</script>` +
  `<style>.x { color: red }</style></head><body>` +
  `<nav><a href="/">Home</a><a href="/about">About</a></nav>${body}` +
  `<footer>© Someone</footer></body></html>`;

test("structured data and the page's own tips both reach the model", () => {
  const text = recipePageText(
    page(
      `<script type="application/ld+json">{"@type":"Recipe","name":"Risotto","recipeIngredient":["1 cup arborio rice"]}</script>` +
        `<article><p>Tip: you can use white wine or more broth.</p><ul><li>1 cup arborio rice</li></ul></article>`,
    ),
  );
  assert.match(text, /"recipeIngredient":\["1 cup arborio rice"\]/);
  assert.match(text, /Tip: you can use white wine or more broth\./);
  assert.doesNotMatch(text, /var ads|color: red|About|Someone/);
});

test("a page without structured data still yields its recipe text", () => {
  const text = recipePageText(
    page(
      `<p>Ingredients:</p><p>200g white chocolate<br>325g self-raising flour</p>`,
    ),
  );
  assert.match(text, /200g white chocolate\s+325g self-raising flour/);
  assert.doesNotMatch(text, /ld\+json/);
});

test("a post that keeps its recipe in the page description, such as an Instagram caption, still reaches the model", () => {
  const text = recipePageText(
    `<html><head><meta property="og:description" content="1K likes - cook: &quot;Dal&#xa0;&#x1f9e1;&#10;-200g red lentils&#10;1. Simmer 20 min&quot;">` +
      `<meta name="description" content="1K likes">` +
      `</head><body><div>Instagram</div></body></html>`,
  );
  assert.match(text, /Dal\u00a0🧡\n-200g red lentils\n1\. Simmer 20 min/);
});

/** The visible page is a shell; the post's own text is in the hydration
 *  JSON, as TikTok serves it. */
const tiktokPage = (item: object) =>
  `<html><head><title>TikTok - Make Your Day</title></head><body>` +
  `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">` +
  JSON.stringify({
    __DEFAULT_SCOPE__: {
      "webapp.video-detail": { itemInfo: { itemStruct: item } },
    },
  }) +
  `</script></body></html>`;

test("a TikTok post's caption and creator reach the model", () => {
  const text = recipePageText(
    tiktokPage({
      desc: "Spaghetti-Eis-Plätzchen 🍝\nZutaten:\n- 90 g weiche Butter\n- 160 g Mehl",
      author: { uniqueId: "miss_gruenkern", nickname: "Miss Grünkern" },
    }),
  );
  assert.match(text, /90 g weiche Butter/);
  assert.match(text, /Miss Grünkern/);
});

test("a TikTok page without the post data, such as a bot challenge, yields no caption", () => {
  const text = recipePageText(
    `<html><head><title>TikTok - Make Your Day</title></head><body><p>Verify to continue</p></body></html>`,
  );
  assert.match(text, /Verify to continue/);
  assert.doesNotMatch(text, /caption/i);
});

test("Instagram and TikTok show Google's fetcher only a shell, so we read them ourselves", () => {
  for (const url of [
    "https://www.instagram.com/p/C4dooVKp-Ax/",
    "https://instagram.com/reel/DT3iH2Ck7jQ/",
    "https://vm.tiktok.com/ZGdXbBDjC/",
    "https://www.tiktok.com/@miss_gruenkern/video/7708068031175462176",
  ]) {
    assert.equal(geminiSeesOnlyAShell(url), true, url);
  }
  for (const url of [
    "https://natashaskitchen.com/classic-risotto-recipe/",
    "https://notinstagram.com/p/x/",
  ]) {
    assert.equal(geminiSeesOnlyAShell(url), false, url);
  }
});
