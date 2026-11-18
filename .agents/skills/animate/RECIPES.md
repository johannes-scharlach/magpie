# Animation Recipes

Ready-to-adapt implementations for Magpie's web pages in `apps/api`. Start
from the matching recipe rather than a blank file. Values come from
`consent-page.ts` and [`SKILL.md`](SKILL.md).

---

## Consent step entrance

A consent step is a `<section class="step" hidden>`. Hiding a section sets
`display: none`, and unhiding it restarts the CSS animation, so no JS mount
flag is needed.

```css
.step {
  animation: step-in 170ms cubic-bezier(0.2, 0.7, 0.3, 1);
}

@keyframes step-in {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .step {
    animation: none;
  }
}
```

```ts
function showStep(next: Step): void {
  emailStep.hidden = next !== "email";
  codeStep.hidden = next !== "code";
  consentStep.hidden = next !== "consent";
  problemStep.hidden = next !== "problem";
  // Keep the resend clock alive across Back/Forward.
  if (next === "consent" || next === "problem") stopResend();
}
```

---

## Field focus and error ring

The ring is a shadow, never a size change, so the card does not move when an
error appears.

```css
.input {
  transition:
    border-color 120ms ease,
    box-shadow 120ms ease,
    background-color 120ms ease;
}

.input:focus {
  border-color: var(--plum);
  box-shadow: 0 0 0 3px var(--ring-soft);
}

.input.is-error {
  border-color: var(--error);
  box-shadow: 0 0 0 3px var(--error-soft);
}
```

```ts
function failEmail(message: string): void {
  emailInput.classList.add("is-error");
  emailInput.setAttribute("aria-invalid", "true");
  emailError.textContent = message;
  emailError.hidden = false;
  emailInput.focus();
}
```

Clear the class and attribute together when the next attempt starts. Do not
animate the message itself beyond a color change; it must be readable the
moment it exists.

---

## Primary button press and busy

The press compresses the pill. The spinner is the pending signal; the label
change must not resize the button.

```css
.primary {
  transition:
    background-color 120ms ease,
    transform 120ms ease,
    opacity 120ms ease;
}

.primary:hover {
  background: var(--plum-hover);
}

.primary:active {
  transform: scale(0.985);
}

.primary:disabled {
  opacity: 0.55;
  cursor: default;
  transform: none;
}

.primary[aria-busy="true"] .spinner {
  display: inline-block;
}

.spinner {
  display: none;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
    border-right-color: currentColor;
    opacity: 0.55;
  }
}
```

```ts
function setBusy(button: HTMLButtonElement, text: string): void {
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  labelOf(button).textContent = text;
}
```

Keep the button full-width or reserve the label's width; never transition
`width`.

---

## Household pick

The radio dot scales in place and the row's border carries the selection. Both
are paint-only and stay under the 300ms ceiling.

```css
.household {
  border: 1px solid var(--line-strong);
  background: var(--field);
  transition:
    border-color 120ms ease,
    background-color 120ms ease;
}

@media (hover: hover) {
  .household:hover {
    background: var(--card);
  }
}

.household:has(input:checked) {
  border-color: var(--plum);
  background: var(--card);
  box-shadow: inset 0 0 0 1px var(--plum);
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

.radio-input:checked ~ .radio::after {
  transform: scale(1);
}
```

Movement is gated behind `(hover: hover)`; the checked state is not.

---

## OTP caret

The caret marks the active slot. It blinks in place and never moves the row.

```css
.caret {
  display: none;
  width: 2px;
  height: 1.05em;
  border-radius: 2px;
  background: var(--plum);
  animation: blink 1.1s steps(2, start) infinite;
}

.otp-slot.is-active .caret {
  display: block;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .caret {
    animation: none;
  }
}
```

The digit cells themselves are instant. Typing six digits must not queue six
animations.

---

## Invite CTA press

The invite page is a static document with inline style and no script. A press
effect belongs in CSS alone; do not add a client just for this.

```css
.open {
  transition:
    transform 120ms ease,
    box-shadow 120ms ease;
}

@media (hover: hover) and (pointer: fine) {
  .open:hover {
    transform: translateY(-1px);
  }
}

.open:active {
  transform: translateY(0) scale(0.99);
}
```

Keep the movement to 1px. The link is a handoff to the app, not a landing
hero.

---

## Landing scroll narrative

Not built yet. When it is, scrub paused WAAPI animations from one coalesced
`requestAnimationFrame`. Do not write `element.style`: use WAAPI so the page
stays compatible with a nonce CSP like the consent page's.

```ts
const clamp = (value: number) => (value >= 1 - 1e-9 ? 1 : value <= 0 ? 0 : value);
const within = (u: number, [from, to]: readonly [number, number]) =>
  clamp((u - from) / (to - from));

type Stage = { readonly animation: Animation; readonly from: number; readonly to: number };

function stage(
  element: Element,
  keyframes: Keyframe[],
  duration: number,
  from: number,
  to: number,
): Stage {
  const animation = element.animate(keyframes, {
    duration,
    easing: "cubic-bezier(0.23, 1, 0.32, 1)",
    fill: "both",
  });
  animation.pause();
  animation.currentTime = 0;
  return { animation, from, to };
}

const hero = document.querySelector("[data-stage='hero']");
const plan = document.querySelector("[data-stage='plan']");
if (!hero || !plan) throw new Error("Landing stages are missing");

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fadeUp: Keyframe[] = [
  { opacity: 0, transform: "translateY(12px)" },
  { opacity: 1, transform: "none" },
];
const stages: Stage[] = [
  stage(hero, fadeUp, 600, 0, 0.35),
  stage(plan, fadeUp, 400, 0.3, 0.6),
];

if (reduce) {
  for (const { animation } of stages) animation.finish();
} else {
  document.documentElement.classList.add("js");
  let scheduled = false;
  const render = () => {
    scheduled = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    const progress = max > 0 ? clamp(scrollY / max) : 1;
    for (const { animation, from, to } of stages) {
      const duration = Number(animation.effect?.getTiming().duration ?? 0);
      animation.currentTime = within(progress, [from, to]) * duration;
    }
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(render);
  };
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
  render();
}
```

Hide the staged elements only under `.js` so a failed script leaves readable
content:

```css
.js [data-stage] {
  opacity: 0;
}
```

---

## Interruptible scroll glide

When a tap advances the narrative to the next stop, ease out from the first
frame, jump under reduced motion, and cancel on any manual input.

```ts
let glide: number | undefined;

function stopGlide(): void {
  if (glide !== undefined) cancelAnimationFrame(glide);
  glide = undefined;
}

function glideTo(targetY: number, maxScroll: number): void {
  if (glide !== undefined || maxScroll <= 0) return;
  const from = scrollY;
  const to = Math.ceil(targetY);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    scrollTo(0, to);
    return;
  }
  const distance = Math.abs(to - from);
  const duration = Math.min(1200, Math.max(600, (distance / maxScroll) * 2400));
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    scrollTo(0, from + (to - from) * (1 - (1 - t) ** 3));
    glide = t < 1 ? requestAnimationFrame(step) : undefined;
  };
  glide = requestAnimationFrame(step);
}

for (const type of ["wheel", "touchstart", "keydown"] as const) {
  addEventListener(type, stopGlide, { passive: true });
}
```
