import assert from "node:assert/strict";
import { test } from "node:test";

import { consentCsp, renderConsentPage } from "./consent-page.js";

const options = {
  supabaseUrl: "https://abc.supabase.co",
  publishableKey: "sb_publishable_x",
  nonce: "nonce-1",
};

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

test("consent page carries the auth calls, household chooser and nonce", () => {
  const page = renderConsentPage(options);
  assert.match(page, /href="\/favicon\.ico"/);
  assert.match(page, /href="\/favicon\.svg"/);
  assert.match(page, /href="\/apple-touch-icon\.png"/);
  assert.match(page, /https:\/\/abc\.supabase\.co/);
  assert.match(page, /sb_publishable_x/);
  assert.match(page, /authorization_id/);
  assert.match(page, /\/auth\/v1/);
  assert.match(page, /"\/otp"/);
  assert.match(page, /"\/verify"/);
  assert.match(page, /\/oauth\/authorizations\//);
  assert.match(page, /"\/oauth\/households"/);
  assert.match(page, /"\/oauth\/household"/);
  assert.match(page, /id="households"/);
  assert.match(page, /method:\s*"PUT"/);
  assert.equal(count(page, 'nonce="nonce-1"'), 2);
});

test("the sign-in and code steps are real form controls", () => {
  const page = renderConsentPage(options);
  assert.match(page, /<form id="email-form"/);
  assert.match(page, /<form id="code-form"/);
  assert.match(page, /<form id="consent-form"/);
  assert.match(page, /id="email"[^>]*autocomplete="email"/);
  assert.match(page, /id="email"[^>]*inputmode="email"/);
  assert.match(page, /id="code"[^>]*inputmode="numeric"/);
  assert.match(page, /id="code"[^>]*autocomplete="one-time-code"/);
  assert.match(page, /id="code"[^>]*pattern="\[0-9\]\*"/);
  assert.match(page, /id="code"[^>]*maxlength="6"/);
  assert.equal(count(page, 'class="otp-slot"'), 6);
  assert.equal(count(page, 'role="alert"'), 3);
  assert.match(page, /id="status"[^>]*role="status"/);
});

test("the page stays inside the nonce CSP: no inline styles or handlers", () => {
  const page = renderConsentPage(options);
  assert.doesNotMatch(page, /\sstyle=/i);
  assert.doesNotMatch(page, /\son[a-z]+\s*=/i);
  assert.match(page, /prefers-color-scheme: dark/);
  assert.match(page, /prefers-reduced-motion: reduce/);
  assert.match(page, /function consentClient\(/);
  assert.match(page, /var __name = function/);
});

test("consent page escapes a value that could close the script", () => {
  const page = renderConsentPage({
    ...options,
    publishableKey: "</script><script>alert(1)</script>",
  });
  assert.equal(page.includes("</script><script>alert(1)</script>"), false);
  assert.match(page, /\\u003c\/script>/);
});

test("consent CSP allows this origin, its icons, and the auth origin", () => {
  assert.equal(
    consentCsp("https://abc.supabase.co", "nonce-1"),
    "default-src 'none'; img-src 'self'; script-src 'nonce-nonce-1'; style-src 'nonce-nonce-1'; connect-src 'self' https://abc.supabase.co; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  );
});
