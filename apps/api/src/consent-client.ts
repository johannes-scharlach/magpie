export type ConsentClientConfig = {
  supabaseUrl: string;
  publishableKey: string;
};

type Household = { id: string; name: string };

/**
 * The consent page's browser client. It is serialized into the page with
 * `Function.prototype.toString()`, so keep it self-contained: no imports, no
 * module-scope helpers, no closures over server state. Everything it needs
 * arrives in `config` or comes from the DOM.
 *
 * The page runs under a nonce CSP with no inline styles. Toggle classes and
 * the `hidden` attribute; never set `element.style`.
 */
export function consentClient(config: ConsentClientConfig): void {
  type Json = Record<string, unknown>;
  type CallOptions = {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
  };

  const authOrigin = config.supabaseUrl.replace(/\/+$/, "");
  const authorizationId = new URLSearchParams(location.search).get(
    "authorization_id",
  );

  function element<T extends HTMLElement>(id: string): T {
    const found = document.getElementById(id);
    if (!found) throw new Error(`Consent page is missing #${id}`);
    return found as T;
  }

  function asRecord(value: unknown): Json {
    return typeof value === "object" && value !== null ? (value as Json) : {};
  }

  function labelOf(button: HTMLButtonElement): HTMLElement {
    const label = button.querySelector<HTMLElement>(".label");
    if (!label) throw new Error(`Consent button #${button.id} has no label`);
    return label;
  }

  const emailStep = element<HTMLElement>("email-step");
  const codeStep = element<HTMLElement>("code-step");
  const consentStep = element<HTMLElement>("consent-step");
  const problemStep = element<HTMLElement>("problem-step");

  const emailForm = element<HTMLFormElement>("email-form");
  const emailInput = element<HTMLInputElement>("email");
  const emailError = element<HTMLElement>("email-error");
  const sendButton = element<HTMLButtonElement>("send");

  const codeForm = element<HTMLFormElement>("code-form");
  const codeInput = element<HTMLInputElement>("code");
  const sentTo = element<HTMLElement>("sent-to");
  const otp = element<HTMLElement>("otp");
  const otpSlots = Array.from(otp.querySelectorAll<HTMLElement>(".otp-slot"));
  const codeError = element<HTMLElement>("code-error");
  const verifyButton = element<HTMLButtonElement>("verify");
  const resendButton = element<HTMLButtonElement>("resend");
  const changeEmailButton = element<HTMLButtonElement>("change-email");

  const consentForm = element<HTMLFormElement>("consent-form");
  const consentTitle = element<HTMLElement>("consent-title");
  const consentLede = element<HTMLElement>("consent-lede");
  const accessCard = element<HTMLElement>("access-card");
  const householdField = element<HTMLElement>("household-field");
  const householdsElement = element<HTMLElement>("households");
  const householdSingle = element<HTMLElement>("household-single");
  const householdSingleName = element<HTMLElement>("household-single-name");
  const consentError = element<HTMLElement>("consent-error");
  const approveButton = element<HTMLButtonElement>("approve");
  const denyButton = element<HTMLButtonElement>("deny");
  const consentNote = element<HTMLElement>("consent-note");

  const problemTitle = element<HTMLElement>("problem-title");
  const problemMessage = element<HTMLElement>("problem-message");
  const problemRetry = element<HTMLButtonElement>("problem-retry");
  const problemSignout = element<HTMLButtonElement>("problem-signout");

  const status = element<HTMLElement>("status");

  type Step = "email" | "code" | "consent" | "problem";

  let accessToken: string | null = null;
  let email = "";
  let busy = false;
  let households: Household[] = [];
  let chosenId: string | null = null;
  let redirectUrl: string | null = null;
  let autoSubmitted = "";
  let resendAt = 0;
  let resendTimer: number | null = null;
  let retryAction: (() => Promise<void>) | null = null;

  function say(message: string): void {
    status.textContent = "";
    if (!message) return;
    window.setTimeout(() => {
      status.textContent = message;
    }, 40);
  }

  function clearEmailError(): void {
    emailError.textContent = "";
    emailError.hidden = true;
    emailInput.removeAttribute("aria-invalid");
  }

  function failEmail(message: string): void {
    emailError.textContent = message;
    emailError.hidden = false;
    emailInput.setAttribute("aria-invalid", "true");
    emailInput.focus();
  }

  function clearCodeError(): void {
    codeError.textContent = "";
    codeError.hidden = true;
    otp.classList.remove("is-error");
    codeInput.removeAttribute("aria-invalid");
  }

  function failCode(message: string): void {
    codeError.textContent = message;
    codeError.hidden = false;
    otp.classList.add("is-error");
    codeInput.setAttribute("aria-invalid", "true");
    codeInput.focus();
    codeInput.select();
  }

  function clearConsentError(): void {
    consentError.textContent = "";
    consentError.hidden = true;
  }

  function failConsent(message: string): void {
    consentError.textContent = message;
    consentError.hidden = false;
    window.setTimeout(() => consentError.focus(), 0);
  }

  function setRadiosDisabled(disabled: boolean): void {
    for (const input of householdsElement.querySelectorAll("input"))
      input.disabled = disabled;
  }

  function setLabel(button: HTMLButtonElement, text: string): void {
    labelOf(button).textContent = text;
  }

  function setBusy(button: HTMLButtonElement, text: string): void {
    busy = true;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    setLabel(button, text);
    changeEmailButton.disabled = true;
    resendButton.disabled = true;
    denyButton.disabled = true;
    problemSignout.disabled = true;
    setRadiosDisabled(true);
  }

  function setIdle(button: HTMLButtonElement, text: string): void {
    busy = false;
    button.disabled = false;
    button.setAttribute("aria-busy", "false");
    setLabel(button, text);
    changeEmailButton.disabled = false;
    problemSignout.disabled = false;
    denyButton.disabled = false;
    setRadiosDisabled(false);
    tickResend();
  }

  function showStep(next: Step): void {
    emailStep.hidden = next !== "email";
    codeStep.hidden = next !== "code";
    consentStep.hidden = next !== "consent";
    problemStep.hidden = next !== "problem";
    // Keep the resend clock alive across Back/Forward. It is spent only once
    // the code has been verified or the flow has ended.
    if (next === "consent" || next === "problem") stopResend();
  }

  function focusStep(next: Step): void {
    if (next === "email") {
      emailInput.focus();
      emailInput.select();
    } else if (next === "code") {
      codeInput.focus();
    } else if (next === "consent") {
      consentTitle.focus();
    } else {
      problemTitle.focus();
    }
  }

  function replaceStep(next: Step): void {
    history.replaceState({ consentStep: next }, "");
    showStep(next);
    focusStep(next);
  }

  function networkError(): Error {
    return new Error(
      "Could not reach Magpie. Check your connection and try again.",
    );
  }

  function messageFor(error: unknown, kind: "email" | "code"): string {
    if (error instanceof Error) {
      const message = error.message.trim();
      if (kind === "email") {
        if (/signups? not allowed|user not found|no user/i.test(message))
          return "No Magpie account uses this email. Create one in the app first.";
        if (/rate limit|too many|only request this after/i.test(message))
          return "Too many attempts. Wait a minute and try again.";
        if (/invalid email|email address .*invalid/i.test(message))
          return "Enter a valid email address.";
      }
      if (kind === "code") {
        if (/rate limit|too many|only request this after/i.test(message))
          return "Too many attempts. Wait a minute and try again.";
        if (/expired|invalid|incorrect|token/i.test(message))
          return "That code is wrong or has expired. Try again or resend a new one.";
      }
      if (message) return message;
    }
    return "Something went wrong. Try again.";
  }

  async function call(path: string, options: CallOptions = {}): Promise<Json> {
    let response: Response;
    try {
      response = await fetch(authOrigin + "/auth/v1" + path, {
        ...options,
        headers: {
          apikey: config.publishableKey,
          "content-type": "application/json",
          ...(options.headers || {}),
        },
      });
    } catch {
      throw networkError();
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const record = asRecord(body);
      const message = record.msg ?? record.message;
      const error = new Error(
        typeof message === "string" && message.trim()
          ? message
          : "Something went wrong. Try again.",
      ) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    return asRecord(body);
  }

  async function api(
    path: string,
    token: string,
    options: CallOptions = {},
  ): Promise<Json> {
    let response: Response;
    try {
      response = await fetch(path, {
        ...options,
        headers: {
          "content-type": "application/json",
          ...(options.headers || {}),
        },
      });
    } catch {
      throw networkError();
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const record = asRecord(body);
      const errorBody = asRecord(record.error);
      const message =
        response.status === 401
          ? "Your sign-in expired. Sign in again."
          : typeof errorBody.message === "string"
            ? errorBody.message
            : "Something went wrong. Try again.";
      const error = new Error(message) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    return asRecord(body);
  }

  function validEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function caretToEnd(): void {
    const end = codeInput.value.length;
    try {
      codeInput.setSelectionRange(end, end);
    } catch {
      // Some mobile keyboards do not expose a selection; typing still works.
    }
  }

  function renderCode(): void {
    const value = codeInput.value.replace(/\D/g, "").slice(0, 6);
    if (codeInput.value !== value) codeInput.value = value;
    const focused = document.activeElement === codeInput;
    otpSlots.forEach((slot, index) => {
      const digit = slot.querySelector<HTMLElement>(".digit");
      if (digit) digit.textContent = value[index] ?? "";
      slot.classList.toggle("is-filled", index < value.length);
      slot.classList.toggle("is-active", focused && index === value.length);
    });
  }

  function formatSeconds(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function startResend(): void {
    resendAt = Date.now() + 60_000;
    tickResend();
    if (resendTimer !== null) window.clearInterval(resendTimer);
    resendTimer = window.setInterval(tickResend, 500);
  }

  function stopResend(): void {
    resendAt = 0;
    if (resendTimer !== null) {
      window.clearInterval(resendTimer);
      resendTimer = null;
    }
    setLabel(resendButton, "Resend code");
    resendButton.disabled = true;
  }

  function tickResend(): void {
    if (resendAt === 0) {
      setLabel(resendButton, "Resend code");
      resendButton.disabled = true;
      return;
    }
    const remaining = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
    if (remaining <= 0) {
      resendAt = 0;
      if (resendTimer !== null) {
        window.clearInterval(resendTimer);
        resendTimer = null;
      }
      setLabel(resendButton, "Resend code");
      resendButton.disabled = busy;
      return;
    }
    setLabel(resendButton, `Resend in ${formatSeconds(remaining)}`);
    resendButton.disabled = true;
  }

  async function sendCode(): Promise<void> {
    if (busy) return;
    clearEmailError();
    clearCodeError();
    const value = emailInput.value.trim();
    if (!value) return failEmail("Enter your email address.");
    if (!validEmail(value)) return failEmail("Enter a valid email address.");
    email = value;
    emailInput.value = value;
    emailInput.readOnly = true;
    setBusy(sendButton, "Sending…");
    say("");
    try {
      await call("/otp", {
        method: "POST",
        body: JSON.stringify({ email, create_user: false }),
      });
      codeInput.value = "";
      autoSubmitted = "";
      renderCode();
      sentTo.textContent = email;
      history.pushState({ consentStep: "code" }, "");
      showStep("code");
      startResend();
      say("Code sent. Check your email.");
      codeInput.focus();
    } catch (error) {
      failEmail(messageFor(error, "email"));
    } finally {
      emailInput.readOnly = false;
      setIdle(sendButton, "Send code");
    }
  }

  async function verifyCode(): Promise<void> {
    if (busy) return;
    const token = codeInput.value.replace(/\D/g, "").slice(0, 6);
    if (token.length !== 6) {
      failCode("Enter all six digits.");
      return;
    }
    clearCodeError();
    codeInput.readOnly = true;
    setBusy(verifyButton, "Signing in…");
    say("");
    try {
      const session = await call("/verify", {
        method: "POST",
        body: JSON.stringify({ email, token, type: "email" }),
      });
      if (typeof session.access_token !== "string")
        throw new Error("Sign-in did not return a session. Try again.");
      accessToken = session.access_token;
      codeInput.value = "";
      renderCode();
      await loadConsent();
    } catch (error) {
      failCode(messageFor(error, "code"));
    } finally {
      codeInput.readOnly = false;
      setIdle(verifyButton, "Sign in");
    }
  }

  function resetAuth(): void {
    accessToken = null;
    households = [];
    chosenId = null;
    redirectUrl = null;
    autoSubmitted = "";
    email = "";
    codeInput.value = "";
    renderCode();
    clearEmailError();
    clearCodeError();
    clearConsentError();
    stopResend();
  }

  function goToEmail(): void {
    resetAuth();
    replaceStep("email");
  }

  async function resendCode(): Promise<void> {
    if (busy || resendAt > 0) return;
    clearCodeError();
    busy = true;
    codeInput.readOnly = true;
    resendButton.disabled = true;
    verifyButton.disabled = true;
    changeEmailButton.disabled = true;
    setLabel(resendButton, "Sending…");
    say("");
    try {
      await call("/otp", {
        method: "POST",
        body: JSON.stringify({ email, create_user: false }),
      });
      codeInput.value = "";
      autoSubmitted = "";
      renderCode();
      startResend();
      say("New code sent.");
      codeInput.focus();
    } catch (error) {
      failCode(messageFor(error, "email"));
    } finally {
      busy = false;
      codeInput.readOnly = false;
      verifyButton.disabled = false;
      changeEmailButton.disabled = false;
      tickResend();
    }
  }

  function clientName(details: Json): string {
    const client = asRecord(details.client);
    const name = client.name ?? client.client_name ?? client.id;
    return typeof name === "string" && name.trim() ? name.trim() : "This app";
  }

  function describeHousehold(): void {
    const chosen = households.find((household) => household.id === chosenId);
    consentNote.textContent = chosen
      ? `Only ${chosen.name}’s data is shared.`
      : "Only the household you choose is shared.";
  }

  function renderHouseholds(): void {
    householdsElement.replaceChildren();
    for (const household of households) {
      const label = document.createElement("label");
      label.className = "household";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "household";
      input.value = household.id;
      input.checked = household.id === chosenId;
      input.className = "radio-input";
      const radio = document.createElement("span");
      radio.className = "radio";
      radio.setAttribute("aria-hidden", "true");
      const name = document.createElement("span");
      name.className = "household-name";
      name.textContent = household.name;
      label.append(input, radio, name);
      householdsElement.append(label);
    }
  }

  function showConsent(choices: Json, details: Json): void {
    const name = clientName(details);
    const named = name !== "This app";
    redirectUrl =
      typeof details.redirect_url === "string" ? details.redirect_url : null;
    const rawHouseholds = Array.isArray(choices.households)
      ? choices.households
      : [];
    households = rawHouseholds.flatMap((item): Household[] => {
      const record = asRecord(item);
      return typeof record.id === "string" && typeof record.name === "string"
        ? [{ id: record.id, name: record.name }]
        : [];
    });
    const selected =
      typeof choices.selected === "string" ? choices.selected : null;
    chosenId = households.some((household) => household.id === selected)
      ? selected
      : (households[0]?.id ?? null);

    consentTitle.textContent = redirectUrl
      ? named
        ? `Continue to ${name}`
        : "Continue"
      : named
        ? `Allow ${name}?`
        : "Allow access?";
    consentLede.textContent = redirectUrl
      ? "You’re signed in. Continue back to finish connecting."
      : `${name} wants to use your Magpie household.`;
    accessCard.hidden = Boolean(redirectUrl);
    denyButton.hidden = Boolean(redirectUrl);
    setLabel(approveButton, redirectUrl ? "Continue" : "Allow");

    if (households.length === 1) {
      householdField.hidden = true;
      householdSingle.hidden = false;
      householdSingleName.textContent = households[0]!.name;
    } else {
      householdField.hidden = false;
      householdSingle.hidden = true;
      renderHouseholds();
    }
    describeHousehold();
    clearConsentError();
    history.replaceState({ consentStep: "consent" }, "");
    showStep("consent");
    say("");
    window.setTimeout(() => consentTitle.focus(), 0);
  }

  async function loadConsent(): Promise<void> {
    if (!accessToken) {
      replaceStep("email");
      return;
    }
    if (!authorizationId) {
      showProblem({
        title: "This link is incomplete",
        message:
          "It is missing its authorization request. Close this page and start again from the app you want to connect.",
      });
      return;
    }
    try {
      const [choices, details] = await Promise.all([
        api("/oauth/households", accessToken, {
          headers: { authorization: "Bearer " + accessToken },
        }),
        call("/oauth/authorizations/" + encodeURIComponent(authorizationId), {
          headers: { authorization: "Bearer " + accessToken },
        }),
      ]);
      if (
        !Array.isArray(choices.households) ||
        choices.households.length === 0
      ) {
        showProblem({
          title: "Set up Magpie first",
          message:
            "This account has no household yet. Finish setting up in the Magpie app, then try again.",
          retry: loadConsent,
          signOut: true,
        });
        return;
      }
      showConsent(choices, details);
    } catch (error) {
      const status = (error as Error & { status?: number }).status;
      const expired = status === 404;
      const unauthorized = status === 401;
      showProblem({
        title: expired ? "This request expired" : "Couldn’t connect",
        message: expired
          ? "Close this page and start again from the app you want to connect."
          : error instanceof Error
            ? error.message
            : "Something went wrong. Try again.",
        retry: expired || unauthorized ? undefined : loadConsent,
        signOut: !expired,
      });
    }
  }

  function showProblem(options: {
    title: string;
    message: string;
    retry?: () => Promise<void>;
    signOut?: boolean;
  }): void {
    retryAction = options.retry ?? null;
    problemTitle.textContent = options.title;
    problemMessage.textContent = options.message;
    problemRetry.hidden = !options.retry;
    problemSignout.hidden = !options.signOut;
    history.replaceState({ consentStep: "problem" }, "");
    showStep("problem");
    say(options.title);
    window.setTimeout(() => problemTitle.focus(), 0);
  }

  async function retry(): Promise<void> {
    if (busy || !retryAction) return;
    clearConsentError();
    setBusy(problemRetry, "Trying…");
    try {
      await retryAction();
    } finally {
      setIdle(problemRetry, "Try again");
    }
  }

  async function approve(): Promise<void> {
    if (busy || !chosenId || !accessToken || !authorizationId) return;
    clearConsentError();
    const idleLabel = redirectUrl ? "Continue" : "Allow";
    setBusy(approveButton, redirectUrl ? "Opening…" : "Allowing…");
    try {
      await api("/oauth/household", accessToken, {
        method: "PUT",
        headers: { authorization: "Bearer " + accessToken },
        body: JSON.stringify({ listId: chosenId }),
      });
      if (redirectUrl) {
        location.assign(redirectUrl);
        return;
      }
      const response = await call(
        "/oauth/authorizations/" +
          encodeURIComponent(authorizationId) +
          "/consent",
        {
          method: "POST",
          headers: { authorization: "Bearer " + accessToken },
          body: JSON.stringify({ action: "approve" }),
        },
      );
      if (typeof response.redirect_url === "string")
        location.assign(response.redirect_url);
      else
        throw new Error(
          "The authorization server returned no redirect. Try again.",
        );
    } catch (error) {
      failConsent(
        error instanceof Error
          ? error.message
          : "Something went wrong. Try again.",
      );
    } finally {
      setIdle(approveButton, idleLabel);
    }
  }

  async function deny(): Promise<void> {
    if (busy || !accessToken || !authorizationId) return;
    clearConsentError();
    setBusy(denyButton, "Denying…");
    try {
      const response = await call(
        "/oauth/authorizations/" +
          encodeURIComponent(authorizationId) +
          "/consent",
        {
          method: "POST",
          headers: { authorization: "Bearer " + accessToken },
          body: JSON.stringify({ action: "deny" }),
        },
      );
      if (typeof response.redirect_url === "string")
        location.assign(response.redirect_url);
      else
        throw new Error(
          "The authorization server returned no redirect. Try again.",
        );
    } catch (error) {
      failConsent(
        error instanceof Error
          ? error.message
          : "Something went wrong. Try again.",
      );
    } finally {
      setIdle(denyButton, "Deny");
    }
  }

  function handleCodeChange(): void {
    renderCode();
    clearCodeError();
    const value = codeInput.value;
    if (value.length < 6) autoSubmitted = "";
    if (value.length === 6 && autoSubmitted !== value) {
      autoSubmitted = value;
      void verifyCode();
    }
  }

  emailForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void sendCode();
  });
  emailInput.addEventListener("input", clearEmailError);

  codeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void verifyCode();
  });
  codeInput.addEventListener("input", handleCodeChange);
  codeInput.addEventListener("paste", (event) => {
    const text = event.clipboardData?.getData("text") ?? "";
    const digits = text.replace(/\D/g, "").slice(0, 6);
    if (!digits) return;
    event.preventDefault();
    codeInput.value = digits;
    handleCodeChange();
  });
  codeInput.addEventListener("focus", () => {
    renderCode();
    caretToEnd();
  });
  codeInput.addEventListener("blur", renderCode);
  codeInput.addEventListener("click", caretToEnd);
  codeInput.addEventListener("keydown", (event) => {
    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight" ||
      event.key === "Home" ||
      event.key === "End"
    ) {
      event.preventDefault();
      caretToEnd();
    }
  });
  for (const slot of otpSlots) {
    slot.addEventListener("click", () => {
      codeInput.focus();
      caretToEnd();
    });
  }

  resendButton.addEventListener("click", () => void resendCode());
  changeEmailButton.addEventListener("click", () => {
    if (!busy) goToEmail();
  });

  consentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void approve();
  });
  denyButton.addEventListener("click", () => void deny());
  householdsElement.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement;
    if (target.name !== "household") return;
    chosenId = target.value;
    describeHousehold();
  });
  // Enter on a radio submits the form by default. Consent is consequential,
  // so only the explicit Allow button may grant it.
  householdsElement.addEventListener("keydown", (event) => {
    if (event.key === "Enter") event.preventDefault();
  });

  problemRetry.addEventListener("click", () => void retry());
  problemSignout.addEventListener("click", () => {
    if (!busy) goToEmail();
  });

  window.addEventListener("popstate", (event) => {
    const state = event.state as { consentStep?: Step } | null;
    const next = state?.consentStep;
    if (next === "email") {
      // Back is navigation, not sign-out. Keep the verified session so
      // Forward returns to a consent screen that can still be approved.
      showStep("email");
      focusStep("email");
    } else if (next === "code") {
      showStep("code");
      focusStep("code");
    } else if (next === "consent") {
      showStep("consent");
      focusStep("consent");
    } else if (next === "problem") {
      showStep("problem");
      focusStep("problem");
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && resendAt > 0) tickResend();
  });

  if (!authorizationId) {
    showProblem({
      title: "This link is incomplete",
      message:
        "It is missing its authorization request. Close this page and start again from the app you want to connect.",
    });
  } else {
    history.replaceState({ consentStep: "email" }, "");
    showStep("email");
    if (window.matchMedia("(pointer: fine)").matches) emailInput.focus();
  }
}
