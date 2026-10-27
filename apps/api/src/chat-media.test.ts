import assert from "node:assert/strict";
import { test } from "node:test";

import { ownStorageUrl } from "./chat-media.js";

const SUPABASE = "https://abc.supabase.co";

test("signed storage paths are fetched from our own Supabase", () => {
  for (const path of [
    "/storage/v1/object/sign/chat-images/list/a.jpg?token=t",
    "/storage/v1/object/sign/chat-voice/list/a.m4a?token=t",
  ]) {
    assert.equal(
      ownStorageUrl(new URL(`${SUPABASE}${path}`), SUPABASE)?.href,
      `${SUPABASE}${path}`,
    );
  }
});

test("a phone that reaches Supabase by another address still works", () => {
  const signed =
    "http://100.112.76.111:55321/storage/v1/object/sign/chat-voice/l/a.m4a?token=t";
  assert.equal(
    ownStorageUrl(new URL(signed), "http://localhost:55321")?.href,
    "http://localhost:55321/storage/v1/object/sign/chat-voice/l/a.m4a?token=t",
  );
});

test("the client's host is never fetched", () => {
  const url = ownStorageUrl(
    new URL("http://169.254.169.254/storage/v1/object/sign/a.jpg?token=t"),
    SUPABASE,
  );
  assert.equal(url?.origin, SUPABASE);
});

test("anything but a signed storage object is refused", () => {
  for (const url of [
    "http://169.254.169.254/latest/meta-data/",
    `${SUPABASE}/rest/v1/profiles`,
    `${SUPABASE}/storage/v1/object/sign/../../../rest/v1/profiles`,
    `${SUPABASE}/storage/v1/object/public/chat-images/a.jpg`,
  ]) {
    assert.equal(ownStorageUrl(new URL(url), SUPABASE), null, url);
  }
});
