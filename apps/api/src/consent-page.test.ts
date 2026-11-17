import assert from "node:assert/strict";
import { test } from "node:test";

import { consentCsp, renderConsentPage } from "./consent-page.js";

const options = {
  supabaseUrl: "https://abc.supabase.co",
  publishableKey: "sb_publishable_x",
  nonce: "nonce-1",
};

test("consent page carries the auth calls and the nonce", () => {
  const page = renderConsentPage(options);
  assert.match(page, /https:\/\/abc\.supabase\.co/);
  assert.match(page, /sb_publishable_x/);
  assert.match(page, /authorization_id/);
  assert.match(page, /SUPABASE_URL \+ "\/auth\/v1" \+ path/);
  assert.match(page, /"\/otp"/);
  assert.match(page, /"\/verify"/);
  assert.match(page, /\/oauth\/authorizations\//);
  assert.match(page, /nonce="nonce-1"/);
});

test("consent page escapes a value that could close the script", () => {
  const page = renderConsentPage({
    ...options,
    publishableKey: "</script><script>alert(1)</script>",
  });
  assert.equal(page.includes("</script><script>alert(1)</script>"), false);
  assert.match(page, /\\u003c\/script>/);
});

test("consent CSP allows only the auth origin and the nonce", () => {
  assert.equal(
    consentCsp("https://abc.supabase.co", "nonce-1"),
    "default-src 'none'; script-src 'nonce-nonce-1'; style-src 'nonce-nonce-1'; connect-src https://abc.supabase.co; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  );
});
