import assert from "node:assert/strict";
import { test } from "node:test";

import { isSignedStorageUrl } from "./chat-media.js";

const SUPABASE = "https://abc.supabase.co";

test("only signed URLs from our own storage are downloaded", () => {
  for (const url of [
    `${SUPABASE}/storage/v1/object/sign/chat-images/list/a.jpg?token=t`,
    `${SUPABASE}/storage/v1/object/sign/chat-voice/list/a.m4a?token=t`,
  ]) {
    assert.equal(isSignedStorageUrl(new URL(url), SUPABASE), true, url);
  }
  for (const url of [
    "http://169.254.169.254/latest/meta-data/",
    "http://[fdaa::3]:8787/",
    "https://abc.supabase.co.evil.com/storage/v1/object/sign/a.jpg",
    "http://abc.supabase.co/storage/v1/object/sign/a.jpg",
    `${SUPABASE}/rest/v1/profiles`,
    `${SUPABASE}/storage/v1/object/sign/../../../rest/v1/profiles`,
    `${SUPABASE}/storage/v1/object/public/chat-images/a.jpg`,
  ]) {
    assert.equal(isSignedStorageUrl(new URL(url), SUPABASE), false, url);
  }
});

test("local Supabase works in dev", () => {
  const local = "http://127.0.0.1:54321";
  assert.equal(
    isSignedStorageUrl(
      new URL(`${local}/storage/v1/object/sign/chat-images/l/a.jpg?token=t`),
      local,
    ),
    true,
  );
});
