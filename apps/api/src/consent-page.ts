import { consentClient } from "./consent-client.js";
import { FAVICON_LINKS } from "./routes/favicons.js";

function scriptValue(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function safeNonce(nonce: string): string {
  return nonce.replace(/[^a-zA-Z0-9-]/g, "");
}

/**
 * The OAuth consent page. Supabase redirects the browser here with an
 * `authorization_id`; the page signs in with the same email code the app
 * uses, chooses a household, then approves or denies the client.
 *
 * The flow is deliberately one dependency-free document: no build step, no
 * SDK, no third-party assets, and a nonce CSP that allows only this inline
 * style and script (plus same-origin icons). The client lives in
 * `consent-client.ts` so it is typechecked; `renderConsentPage` serializes
 * it into the document.
 */
export function renderConsentPage(opts: {
  supabaseUrl: string;
  publishableKey: string;
  nonce: string;
}): string {
  const supabaseUrl = scriptValue(opts.supabaseUrl.replace(/\/+$/, ""));
  const publishableKey = scriptValue(opts.publishableKey);
  const nonce = safeNonce(opts.nonce);
  const client = consentClient.toString();
  if (client.includes("</script"))
    throw new Error("The consent client must not contain a script terminator.");
  const config = `{ supabaseUrl: ${supabaseUrl}, publishableKey: ${publishableKey} }`;
  // tsx (dev) compiles with esbuild's keepNames, which decorates every named
  // function through a module-scope helper. The serialized function cannot
  // carry that helper, so give it the same definition before calling it.
  const keepNames = `var __name = function (target, value) {
    try { Object.defineProperty(target, "name", { value: value, configurable: true }); }
    catch (error) {}
    return target;
  };`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#fbf8f4" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#201b1e" media="(prefers-color-scheme: dark)">
<title>Connect Magpie</title>
${FAVICON_LINKS}
<style nonce="${nonce}">
  :root {
    color-scheme: light dark;
    /* Mirrors the app palette in apps/mobile/src/global.css. The consent
       page is a separate web surface and cannot import the uniwind bundle;
       keep these values in sync when the tokens change. */
    --font-display: ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN",
      "Arial Rounded MT Bold", ui-sans-serif, system-ui, sans-serif;
    --font-body: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    --paper: #fbf8f4;
    --wash: rgb(243 224 213 / 48%);
    --card: #fffdf9;
    --ink: #2e2c29;
    --muted: #5f5c57;
    --line: #e3dad2;
    --line-strong: #9c8d82;
    --field: #fbf8f4;
    --plum: #492f40;
    --plum-hover: #3a2332;
    --on-plum: #ffffff;
    --peach: #f3e0d5;
    --peach-ink: #492f40;
    --link: #8a4f74;
    --secondary: #f1ece6;
    --error: #b42318;
    --error-soft: rgb(180 35 24 / 14%);
    --ring-soft: rgb(73 47 64 / 18%);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --paper: #201b1e;
      --wash: rgb(81 61 73 / 42%);
      --card: #2c2529;
      --ink: #faf7f2;
      --muted: #d5cbc6;
      --line: #4a3e45;
      --line-strong: #7a6b73;
      --field: #241f22;
      --plum: #ebc7b3;
      --plum-hover: #f3d6c6;
      --on-plum: #492f40;
      --peach: #513d49;
      --peach-ink: #faf7f2;
      --link: #ebc7b3;
      --secondary: #3b3238;
      --error: #ffb4ab;
      --error-soft: rgb(255 180 171 / 16%);
      --ring-soft: rgb(235 199 179 / 22%);
    }
  }
  * { box-sizing: border-box; }
  html {
    -webkit-text-size-adjust: 100%;
    background: var(--paper);
  }
  body {
    margin: 0;
    min-height: 100vh;
    min-height: 100svh;
    background:
      radial-gradient(90% 55% at 50% 0%, var(--wash), transparent 72%),
      var(--paper);
    color: var(--ink);
    font-family: var(--font-body);
    font-size: 16px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  ::selection { background: var(--peach); color: var(--ink); }
  button, input { font: inherit; }
  button { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  [hidden] { display: none !important; }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .page {
    min-height: 100vh;
    min-height: 100svh;
    display: flex;
    padding: 24px 16px calc(22px + env(safe-area-inset-bottom));
    padding-top: max(24px, env(safe-area-inset-top));
  }
  .shell {
    width: 100%;
    max-width: 420px;
    margin: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-inline: 4px;
  }
  .brand-mark {
    width: 27px;
    height: 27px;
    display: block;
    flex: none;
  }
  .brand-name {
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .card {
    width: 100%;
    padding: clamp(20px, 6vw, 30px);
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 22px;
  }
  .step { animation: step-in 170ms cubic-bezier(0.2, 0.7, 0.3, 1); }
  @keyframes step-in {
    from { opacity: 0; transform: translateY(3px); }
    to { opacity: 1; transform: none; }
  }
  .step-title {
    margin: 0 0 8px;
    font-family: var(--font-display);
    font-size: clamp(1.75rem, 6vw, 2.05rem);
    font-weight: 800;
    letter-spacing: -0.025em;
    line-height: 1.1;
    text-wrap: balance;
  }
  .step-title:focus { outline: none; }
  .lede {
    margin: 0 0 24px;
    color: var(--muted);
    font-size: 1.0625rem;
    line-height: 1.5;
    text-wrap: pretty;
  }
  .lede strong {
    color: var(--ink);
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  form { display: grid; gap: 14px; margin: 0; }
  .field { display: grid; gap: 7px; }
  .field-label {
    margin: 0;
    padding: 0;
    color: var(--ink);
    font-size: 0.9375rem;
    font-weight: 600;
  }
  .input {
    width: 100%;
    height: 52px;
    margin: 0;
    padding: 0 15px;
    border: 1px solid var(--line-strong);
    border-radius: 14px;
    background: var(--field);
    color: var(--ink);
    font-size: 1.0625rem;
    line-height: 1.2;
    transition: border-color 120ms ease, box-shadow 120ms ease,
      background-color 120ms ease;
  }
  .input::placeholder { color: var(--muted); opacity: 0.65; }
  .input:focus {
    outline: none;
    border-color: var(--ring, var(--plum));
    background: var(--card);
    box-shadow: 0 0 0 3px var(--ring-soft);
  }
  .input[aria-invalid="true"] {
    border-color: var(--error);
    box-shadow: 0 0 0 3px var(--error-soft);
  }
  .input:-webkit-autofill,
  .input:-webkit-autofill:hover,
  .input:-webkit-autofill:focus {
    -webkit-text-fill-color: var(--ink);
    -webkit-box-shadow: 0 0 0 1000px var(--field) inset;
    caret-color: var(--ink);
  }
  .error {
    margin: 0;
    color: var(--error);
    font-size: 0.9375rem;
    line-height: 1.4;
  }
  .error:focus { outline: none; }

  .primary {
    width: 100%;
    min-height: 52px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    padding: 0 22px;
    border: 0;
    border-radius: 999px;
    background: var(--plum);
    color: var(--on-plum);
    font-size: 1.0625rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 120ms ease, transform 120ms ease,
      opacity 120ms ease;
  }
  .primary:hover { background: var(--plum-hover); }
  .primary:active { transform: scale(0.985); }
  .primary:focus-visible {
    outline: 2px solid var(--plum);
    outline-offset: 3px;
  }
  .primary:disabled { opacity: 0.55; cursor: default; transform: none; }
  .spinner {
    display: none;
    width: 16px;
    height: 16px;
    flex: none;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  .primary[aria-busy="true"] .spinner { display: inline-block; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .actions-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0 16px;
    margin-top: 14px;
  }
  .link {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    padding: 0;
    border: 0;
    background: none;
    color: var(--link);
    font-size: 0.9375rem;
    font-weight: 600;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
    cursor: pointer;
  }
  .link:hover { color: var(--ink); }
  .link:focus-visible {
    outline: 2px solid var(--plum);
    outline-offset: 3px;
    border-radius: 4px;
  }
  .link:disabled {
    color: var(--muted);
    opacity: 0.55;
    text-decoration: none;
    cursor: default;
  }
  .quiet-link {
    color: var(--muted);
    font-weight: 500;
    text-decoration: none;
  }
  .quiet-link:hover { color: var(--ink); text-decoration: underline; }
  .quiet {
    width: 100%;
    min-height: 46px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 18px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--muted);
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 120ms ease, color 120ms ease;
  }
  .quiet:hover { background: var(--secondary); color: var(--ink); }
  .quiet:focus-visible {
    outline: 2px solid var(--plum);
    outline-offset: 2px;
  }
  .quiet:disabled { opacity: 0.55; cursor: default; }
  .footnote {
    margin: 18px 0 0;
    color: var(--muted);
    font-size: 0.8125rem;
    line-height: 1.45;
    text-wrap: pretty;
  }

  .otp-wrap { position: relative; }
  .otp {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: clamp(5px, 1.6vw, 8px);
  }
  .otp-slot {
    position: relative;
    aspect-ratio: 6 / 7;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--line-strong);
    border-radius: clamp(10px, 3vw, 14px);
    background: var(--field);
    font-family: var(--font-display);
    font-size: clamp(1.25rem, 4.8vw, 1.6rem);
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    transition: border-color 120ms ease, background-color 120ms ease,
      box-shadow 120ms ease;
  }
  .otp-slot.is-filled { background: var(--card); }
  .otp-slot.is-active {
    border-color: var(--plum);
    background: var(--card);
    box-shadow: 0 0 0 3px var(--ring-soft);
  }
  .otp.is-error .otp-slot { border-color: var(--error); }
  .otp.is-error .otp-slot.is-active {
    box-shadow: 0 0 0 3px var(--error-soft);
  }
  .caret {
    display: none;
    width: 2px;
    height: 1.05em;
    border-radius: 2px;
    background: var(--plum);
    animation: blink 1.1s steps(2, start) infinite;
  }
  .otp-slot.is-active .caret { display: block; }
  @keyframes blink { 50% { opacity: 0; } }
  .otp-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 14px;
    background: transparent;
    color: transparent;
    caret-color: transparent;
    opacity: 0.001;
    font-size: 16px;
    cursor: text;
  }
  .otp-input:focus { outline: none; }
  .otp-input:-webkit-autofill {
    -webkit-text-fill-color: transparent;
    -webkit-box-shadow: 0 0 0 1000px transparent inset;
  }

  .access {
    margin: 0 0 18px;
    padding: 15px 16px;
    border-radius: 16px;
    background: var(--peach);
    color: var(--peach-ink);
  }
  .access-label {
    margin: 0 0 9px;
    font-size: 0.8125rem;
    font-weight: 650;
    opacity: 0.75;
  }
  .access-list {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .access-list li {
    display: flex;
    gap: 9px;
    font-size: 0.9375rem;
    line-height: 1.4;
  }
  .tick {
    width: 16px;
    height: 16px;
    flex: none;
    margin-top: 2px;
    color: var(--plum);
  }

  .household-field {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .household-field legend {
    margin-bottom: 9px;
    padding: 0;
  }
  .households { display: grid; gap: 8px; }
  .household {
    position: relative;
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 0 14px;
    border: 1px solid var(--line-strong);
    border-radius: 14px;
    background: var(--field);
    cursor: pointer;
    transition: border-color 120ms ease, background-color 120ms ease;
  }
  @media (hover: hover) {
    .household:hover { background: var(--card); }
  }
  .household:has(input:checked) {
    border-color: var(--plum);
    background: var(--card);
    box-shadow: inset 0 0 0 1px var(--plum);
  }
  .household:has(input:focus-visible) {
    outline: 2px solid var(--plum);
    outline-offset: 2px;
  }
  .radio-input {
    position: absolute;
    inset: 0;
    z-index: 1;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .radio {
    width: 20px;
    height: 20px;
    flex: none;
    display: grid;
    place-items: center;
    border: 1.5px solid var(--line-strong);
    border-radius: 50%;
    transition: border-color 120ms ease;
  }
  .radio::after {
    content: "";
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--plum);
    transform: scale(0);
    transition: transform 120ms ease;
  }
  .radio-input:checked ~ .radio { border-color: var(--plum); }
  .radio-input:checked ~ .radio::after { transform: scale(1); }
  .household-name { font-weight: 550; }
  .household-single {
    min-height: 52px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 14px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--field);
  }
  .household-single .field-label { margin: 0; }
  .household-single-name {
    font-weight: 600;
    text-align: right;
    overflow-wrap: anywhere;
  }

  .page-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    color: var(--muted);
    font-size: 0.8125rem;
  }
  .lock { width: 13px; height: 13px; flex: none; }
  .dot { opacity: 0.6; }
  .noscript {
    margin: 0;
    color: var(--error);
    font-size: 0.9375rem;
    text-align: center;
  }

  @media (max-width: 380px) {
    .page { padding-inline: 12px; }
    .card { padding: 20px 16px; }
    .actions-row { justify-content: flex-start; }
  }
  @media (prefers-reduced-motion: reduce) {
    .step { animation: none; }
    .spinner { animation: none; border-right-color: currentColor; opacity: 0.55; }
    .caret { animation: none; }
    .primary, .quiet, .radio, .radio::after, .step { transition: none; }
  }
  @media (forced-colors: active) {
    .card, .input, .otp-slot, .household, .household-single, .access {
      border: 1px solid CanvasText;
    }
    .primary { border: 1px solid ButtonText; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="shell">
    <header class="brand">
      <img class="brand-mark" src="/favicon.svg" alt="" width="27" height="27">
      <span class="brand-name">Magpie</span>
    </header>

    <main class="card">
      <section id="email-step" class="step" aria-labelledby="email-title">
        <h1 id="email-title" class="step-title" tabindex="-1">Sign in</h1>
        <p class="lede">Enter the email you use in Magpie. We’ll send you a six-digit code.</p>
        <form id="email-form" novalidate>
          <div class="field">
            <label class="field-label" for="email">Email</label>
            <input id="email" class="input" type="email" name="email"
              inputmode="email" autocomplete="email" autocapitalize="none"
              autocorrect="off" spellcheck="false" enterkeyhint="send"
              placeholder="you@example.com" aria-describedby="email-error">
          </div>
          <p id="email-error" class="error" role="alert" hidden></p>
          <button id="send" class="primary" type="submit">
            <span class="spinner" aria-hidden="true"></span><span class="label">Send code</span>
          </button>
        </form>
        <p class="footnote">Magpie accounts are created in the app.</p>
      </section>

      <section id="code-step" class="step" aria-labelledby="code-title" hidden>
        <h1 id="code-title" class="step-title" tabindex="-1">Check your email</h1>
        <p class="lede">Enter the six-digit code we sent to <strong id="sent-to"></strong>.</p>
        <form id="code-form" novalidate>
          <div class="otp-wrap">
            <div id="otp" class="otp" aria-hidden="true">
              <div class="otp-slot"><span class="digit"></span><span class="caret"></span></div>
              <div class="otp-slot"><span class="digit"></span><span class="caret"></span></div>
              <div class="otp-slot"><span class="digit"></span><span class="caret"></span></div>
              <div class="otp-slot"><span class="digit"></span><span class="caret"></span></div>
              <div class="otp-slot"><span class="digit"></span><span class="caret"></span></div>
              <div class="otp-slot"><span class="digit"></span><span class="caret"></span></div>
            </div>
            <input id="code" class="otp-input" type="text" inputmode="numeric"
              pattern="[0-9]*" maxlength="6" autocomplete="one-time-code"
              enterkeyhint="done" spellcheck="false"
              aria-label="Six-digit code" aria-describedby="code-lede code-error">
          </div>
          <p id="code-lede" class="sr-only">Enter the six-digit code from the email.</p>
          <p id="code-error" class="error" role="alert" hidden></p>
          <button id="verify" class="primary" type="submit">
            <span class="spinner" aria-hidden="true"></span><span class="label">Sign in</span>
          </button>
        </form>
        <div class="actions-row">
          <button id="resend" class="link" type="button" disabled><span class="label">Resend code</span></button>
          <button id="change-email" class="link quiet-link" type="button">Use a different email</button>
        </div>
      </section>

      <section id="consent-step" class="step" aria-labelledby="consent-title" hidden>
        <h1 id="consent-title" class="step-title" tabindex="-1">Allow access?</h1>
        <p id="consent-lede" class="lede"></p>
        <div id="access-card" class="access">
          <p class="access-label">It can</p>
          <ul class="access-list">
            <li>
              <svg class="tick" viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10.5l3.2 3.2 7.8-7.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span>Read your recipes, plan and cooking preferences</span>
            </li>
            <li>
              <svg class="tick" viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10.5l3.2 3.2 7.8-7.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span>Add and remove meals from your plan</span>
            </li>
            <li>
              <svg class="tick" viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10.5l3.2 3.2 7.8-7.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span>Save recipes to your cookbook</span>
            </li>
          </ul>
        </div>
        <form id="consent-form" novalidate>
          <fieldset id="household-field" class="household-field">
            <legend class="field-label">Household</legend>
            <div id="households" class="households"></div>
          </fieldset>
          <div id="household-single" class="household-single" hidden>
            <span class="field-label">Household</span>
            <span id="household-single-name" class="household-single-name"></span>
          </div>
          <p id="consent-error" class="error" role="alert" tabindex="-1" hidden></p>
          <button id="approve" class="primary" type="submit">
            <span class="spinner" aria-hidden="true"></span><span class="label">Allow</span>
          </button>
          <button id="deny" class="quiet" type="button">Deny</button>
        </form>
        <p id="consent-note" class="footnote"></p>
      </section>

      <section id="problem-step" class="step" aria-labelledby="problem-title" hidden>
        <h1 id="problem-title" class="step-title" tabindex="-1">Something went wrong</h1>
        <p id="problem-message" class="lede"></p>
        <button id="problem-retry" class="primary" type="button" hidden>
          <span class="spinner" aria-hidden="true"></span><span class="label">Try again</span>
        </button>
        <button id="problem-signout" class="quiet" type="button" hidden>Use a different email</button>
      </section>
    </main>

    <footer class="page-footer">
      <svg class="lock" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.2" y="7" width="9.6" height="6.6" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5.6 7V5.4a2.4 2.4 0 014.8 0V7" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      <span>magpiemeals.com</span>
      <span class="dot" aria-hidden="true">·</span>
      <span>Secure sign-in</span>
    </footer>

    <noscript>
      <p class="noscript">JavaScript is required to connect Magpie. Enable it and reload this page.</p>
    </noscript>
  </div>
</div>
<div id="status" class="sr-only" role="status"></div>
<script nonce="${nonce}">
${keepNames}
(${client})(${config});
</script>
</body>
</html>`;
}

export function consentCsp(supabaseUrl: string, nonce: string): string {
  const origin = new URL(supabaseUrl).origin;
  return [
    "default-src 'none'",
    "img-src 'self'",
    `script-src 'nonce-${safeNonce(nonce)}'`,
    `style-src 'nonce-${safeNonce(nonce)}'`,
    `connect-src 'self' ${origin}`,
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}
