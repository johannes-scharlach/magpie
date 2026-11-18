function scriptValue(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function safeNonce(nonce: string): string {
  return nonce.replace(/[^a-zA-Z0-9-]/g, "");
}

/**
 * The OAuth consent page. Supabase redirects the browser here with an
 * `authorization_id`; the page signs in with the same email code the app
 * uses, chooses a household, then approves or denies the client. No build
 * step and no SDK: the auth and household calls are plain `fetch`.
 */
export function renderConsentPage(opts: {
  supabaseUrl: string;
  publishableKey: string;
  nonce: string;
}): string {
  const supabaseUrl = scriptValue(opts.supabaseUrl.replace(/\/+$/, ""));
  const publishableKey = scriptValue(opts.publishableKey);
  const nonce = safeNonce(opts.nonce);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect Magpie</title>
<style nonce="${nonce}">
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    padding: 24px; background: #f4f1ea; color: #22201c;
    font: 16px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif;
  }
  main {
    width: 100%; max-width: 380px; padding: 28px;
    background: #fffdf8; border: 1px solid #ded6c8; border-radius: 16px;
    box-shadow: 0 12px 32px rgb(50 40 20 / 8%);
  }
  h1 { margin: 0 0 8px; font-size: 1.4rem; }
  p { margin: 0 0 20px; color: #57514a; }
  label { display: block; margin-bottom: 6px; font-weight: 600; }
  input, select {
    width: 100%; padding: 11px 12px; margin-bottom: 14px;
    border: 1px solid #c9c0b1; border-radius: 10px;
    background: #fff; color: inherit; font: inherit;
  }
  button {
    width: 100%; padding: 12px; margin-top: 4px;
    border: 0; border-radius: 10px; background: #22201c; color: #fff;
    font: inherit; font-weight: 600; cursor: pointer;
  }
  button.secondary { background: transparent; color: #57514a; }
  button:disabled { opacity: .55; cursor: default; }
  .row { display: flex; gap: 10px; }
  .row button { margin-top: 0; }
  #status { margin: 16px 0 0; min-height: 1.5em; color: #57514a; }
  [hidden] { display: none !important; }
</style>
</head>
<body>
<main>
  <h1>Connect Magpie</h1>
  <p>Sign in with the email you use in Magpie.</p>

  <section id="email-step">
    <label for="email">Email</label>
    <input id="email" type="email" autocomplete="email" inputmode="email">
    <button id="send">Send code</button>
  </section>

  <section id="code-step" hidden>
    <label for="code">Code from the email</label>
    <input id="code" type="text" autocomplete="one-time-code" inputmode="numeric">
    <button id="verify">Sign in</button>
  </section>

  <section id="consent-step" hidden>
    <p id="client"></p>
    <div id="household-field" hidden>
      <label for="household">Household</label>
      <select id="household"></select>
    </div>
    <div class="row">
      <button id="approve">Allow</button>
      <button id="deny" class="secondary">Deny</button>
    </div>
  </section>

  <p id="status" role="status"></p>
</main>
<script nonce="${nonce}">
  const SUPABASE_URL = ${supabaseUrl};
  const PUBLISHABLE_KEY = ${publishableKey};
  const authorizationId = new URLSearchParams(location.search).get("authorization_id");
  const emailStep = document.getElementById("email-step");
  const codeStep = document.getElementById("code-step");
  const consentStep = document.getElementById("consent-step");
  const householdField = document.getElementById("household-field");
  const householdSelect = document.getElementById("household");
  const clientLine = document.getElementById("client");
  const approve = document.getElementById("approve");
  const deny = document.getElementById("deny");
  const status = document.getElementById("status");
  let accessToken = null;
  let email = "";
  let busy = false;
  let authorization = null;
  let households = [];
  let chosenId = null;
  let redirectUrl = null;

  function show(step) {
    for (const section of [emailStep, codeStep, consentStep]) section.hidden = section !== step;
  }

  function say(message) {
    status.textContent = message;
  }

  async function call(path, options = {}) {
    const response = await fetch(SUPABASE_URL + "/auth/v1" + path, {
      ...options,
      headers: {
        apikey: PUBLISHABLE_KEY,
        "content-type": "application/json",
        ...(options.headers || {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.msg || body.message || "Something went wrong.");
    }
    return body;
  }

  // Same-origin API calls: these two routes live on this origin, unlike the
  // Supabase auth calls above.
  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(options.headers || {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error?.message || "Something went wrong.");
    }
    return body;
  }

  function clientName() {
    const client = authorization?.client || {};
    return client.name || client.client_name || client.id || null;
  }

  function describe() {
    const chosen = households.find((household) => household.id === chosenId);
    if (!chosen) return;
    const name = clientName();
    if (redirectUrl) {
      clientLine.textContent = name
        ? "Continue to " + name + " with " + chosen.name + "."
        : "Continue with " + chosen.name + ".";
      return;
    }
    clientLine.textContent =
      "Allow " + (name || "This application") + " to read and change " + chosen.name + "'s recipes and plan, as you?";
  }

  function showChoice(choices, details) {
    authorization = details;
    redirectUrl = typeof details.redirect_url === "string" ? details.redirect_url : null;
    households = choices.households || [];
    if (!households.length) {
      show(null);
      say("Finish setting up your household in Magpie first.");
      return;
    }
    chosenId = households.some((household) => household.id === choices.selected)
      ? choices.selected
      : households[0].id;
    if (households.length > 1) {
      householdSelect.replaceChildren();
      for (const household of households) {
        const option = document.createElement("option");
        option.value = household.id;
        option.textContent = household.name;
        option.selected = household.id === chosenId;
        householdSelect.appendChild(option);
      }
      householdSelect.addEventListener("change", () => {
        chosenId = householdSelect.value;
        describe();
      });
      householdField.hidden = false;
    }
    approve.textContent = redirectUrl ? "Continue" : "Allow";
    deny.hidden = Boolean(redirectUrl);
    describe();
    show(consentStep);
  }

  async function withBusy(button, work) {
    if (busy) return;
    busy = true;
    button.disabled = true;
    say("");
    try {
      await work();
    } catch (error) {
      say(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      busy = false;
      button.disabled = false;
    }
  }

  if (!authorizationId) {
    show(null);
    say("This page is missing its authorization request.");
  } else {
    document.getElementById("send").addEventListener("click", (event) =>
      withBusy(event.currentTarget, async () => {
        email = document.getElementById("email").value.trim();
        if (!email) throw new Error("Enter your email.");
        await call("/otp", {
          method: "POST",
          body: JSON.stringify({ email, create_user: false }),
        });
        show(codeStep);
        document.getElementById("code").focus();
        say("Code sent.");
      }),
    );

    document.getElementById("verify").addEventListener("click", (event) =>
      withBusy(event.currentTarget, async () => {
        const token = document.getElementById("code").value.trim();
        if (!token) throw new Error("Enter the code from the email.");
        const session = await call("/verify", {
          method: "POST",
          body: JSON.stringify({ email, token, type: "email" }),
        });
        accessToken = session.access_token;
        const [choices, details] = await Promise.all([
          api("/oauth/households", {
            headers: { authorization: "Bearer " + accessToken },
          }),
          call(
            "/oauth/authorizations/" + encodeURIComponent(authorizationId),
            { headers: { authorization: "Bearer " + accessToken } },
          ),
        ]);
        showChoice(choices, details);
      }),
    );

    async function decide(action) {
      const response = await call(
        "/oauth/authorizations/" + encodeURIComponent(authorizationId) + "/consent",
        {
          method: "POST",
          headers: { authorization: "Bearer " + accessToken },
          body: JSON.stringify({ action }),
        },
      );
      if (response.redirect_url) location.assign(response.redirect_url);
      else say("The authorization server returned no redirect.");
    }

    document.getElementById("approve").addEventListener("click", (event) =>
      withBusy(event.currentTarget, async () => {
        await api("/oauth/household", {
          method: "PUT",
          headers: { authorization: "Bearer " + accessToken },
          body: JSON.stringify({ listId: chosenId }),
        });
        if (redirectUrl) {
          location.assign(redirectUrl);
          return;
        }
        await decide("approve");
      }),
    );
    document.getElementById("deny").addEventListener("click", (event) =>
      withBusy(event.currentTarget, () => decide("deny")),
    );
  }
</script>
</body>
</html>`;
}

export function consentCsp(supabaseUrl: string, nonce: string): string {
  const origin = new URL(supabaseUrl).origin;
  return [
    "default-src 'none'",
    `script-src 'nonce-${safeNonce(nonce)}'`,
    `style-src 'nonce-${safeNonce(nonce)}'`,
    `connect-src 'self' ${origin}`,
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}
