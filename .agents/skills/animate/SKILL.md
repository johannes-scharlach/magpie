---
name: animate
description: Motion for Magpie's website in apps/api (magpiemeals.com). Use when adding or fixing page transitions, step entrances, pending states, hover and press feedback, scroll-driven landing motion, or reduced-motion behavior, or when motion stutters or feels mistimed. For the Expo app use expo-animation instead.
---

# Animate

Magpie's website is served by `apps/api` (ADR 40): dependency-free Hono JSX
documents with inline CSS, a nonce CSP, and, when a page needs behavior, one
typechecked browser function serialized into it. There is no React, no
animation library, no web font, and no third-party asset. The app is a separate
surface; its motion belongs to `expo-animation`.

Run steps 1–8 in order. Steps 1 and 2 are a hard gate: when a motion request
fails them, write no animation and ship the instant state change.

## 1. Frequency gate

Classify how often a person triggers the interaction before choosing a curve.

| Tier | Examples on Magpie's pages | Decision |
| --- | --- | --- |
| **100+ / session** | Keystrokes in the email and code fields, focus changes, caret movement, choosing a household or a digit | **Instant.** `0ms` state swap. Stop here. |
| **Tens / session** | Primary and quiet button hover/press, resend, field focus ring, link hover | **Near-imperceptible:** 100–160ms, subtle transform/color only. |
| **Occasional** | Consent step advance, inline error, pending → done on a button, the invite CTA | **Standard transition:** 160–250ms. |
| **Narrative / rare** | Landing scroll, article reveal, a share page's hero | **Choreographed motion:** scroll-locked or 300–600ms staged curves. |

Typing and focus must never wait on a curve. A 120ms fade on each of six code
digits makes entering the code feel laggy by the third one.

## 2. Purpose gate

Name the motion's job in **one token** before continuing:

- **feedback** — confirming the page registered input (OTP slot focus, button press)
- **spatial-consistency** — showing where a surface came from or went (the next consent step arriving from below, Back returning to the previous one)
- **state-indication** — making a state change legible (field error, button busy, code accepted, household chosen)
- **bridging** — softening a sudden mount (error text appearing under a field, a new step's card replacing the last)
- **explanation** — demonstrating one idea on the landing page (how a plan becomes a shopping list)
- **delight** — reserved exclusively for the **narrative / rare** tier

If none of the six applies, stop and ship a static state change.

## 3. Page rules

- **Know the page.** `/oauth/consent` (`consent-page.ts`), `/join/:code`
  (`routes/invitations.ts`), `/r/:id` (`routes/shared-recipe-page.ts`), and the
  website itself (`/`, articles, legal). Each owns its `<style>`; there is no
  shared stylesheet yet.
- **Copy the palette, do not invent one.** `consent-page.ts` mirrors
  `apps/mobile/src/global.css`: `--paper`, `--card`, `--ink`, `--muted`,
  `--line`, `--line-strong`, `--plum`, `--on-plum`, `--peach`, `--link`,
  `--error`, `--error-soft`, `--ring-soft`, `--font-display`, `--font-body`,
  plus the dark values under `prefers-color-scheme: dark`.
- **The CSP decides the API.** Consent is nonce-bound for style and script;
  invite and share allow inline style and ship no script at all. Toggle
  classes, attributes, and `hidden` rather than setting `element.style`: the
  consent page blocks style attributes, so the same client works on every page.
- **Invite and share ship no script.** Adding behavior there means adding a
  nonce'd script like consent, not loosening the policy to `unsafe-inline`.
- **Browser code is one function.** Put it in
  `apps/api/src/<page>-client.ts` and serialize it with
  `Function.prototype.toString()`; it may not import, keep module-scope
  helpers, or close over server state. `consent-client.ts` is the reference.
  Everything it needs arrives in `config` or comes from the DOM.
- **Stay dependency-free.** A page that outgrows serialization gets an esbuild
  client bundle beside the server (ADR 40), still plain typechecked
  TypeScript. No frameworks, no animation packages, no web fonts.

## 4. Tool ladder

Walk down and stop at the cheapest tool that satisfies the interaction.

| Need | Tool |
| --- | --- |
| State toggle driven by class, attribute, or pseudo-class (`:hover`, `[aria-busy]`, `:has(input:checked)`, `.is-error`) | **CSS `transition`** |
| One-shot entrance on mount or unhide, or an ambient loop (spinner, caret) | **CSS `@keyframes`** or **`@starting-style`** |
| Programmatic one-shot that needs a completion callback, dynamic endpoints, or scroll scrubbing | **Web Animations API** (`element.animate()`) |
| Scroll narrative with several stages | **Paused WAAPI animations scrubbed by one `requestAnimationFrame`** |

Use CSS transitions for anything a person can re-trigger mid-flight: transitions
retarget smoothly from the current value, whereas `@keyframes` restart at `0%`.

## 5. Compositor discipline

- **Animate `transform`, `opacity`, and `clip-path`.** Color and
  `background-color` may transition for feedback; they paint but stay cheap at
  this size. List the exact properties in `transition`, as the consent page
  does.
- **Start entrances near full size:** `opacity: 0` with `translateY(3px)` (the
  consent step) or `scale(0.97)` gives the element visible mass from frame one.
- **Anchor popovers to their trigger:** set `transform-origin` toward the
  button or edge that opened it, and translate `4px–8px` along the opening
  axis. Use `transform-origin: center` only for centered surfaces.
- **Never animate layout.** Height, width, margin, `top`/`left`, and grid
  tracks force the browser to re-lay-out every frame. Let content reflow
  instantly and fade the new element in.
- **Pair `visibility` with `opacity` + `transform`** for surfaces that stay in
  the DOM: transition `visibility 0s <duration>` on close and `0s 0s` on open,
  so the hidden element ignores pointers while the exit still plays.
- **SVG:** animate `stroke-dashoffset` for a draw-on, not path geometry. Keep
  icons inline and sized by CSS.
- **No filter or blur animation, no parallax on text.** Never animate a focus
  ring away.

## 6. Curves and durations

Take values from this table; they come from the pages that already ship.

| Situation | Curve | Duration |
| --- | --- | --- |
| Field focus and error ring (`border-color`, `box-shadow`) | `ease` | `120ms` |
| Primary press (`transform: scale(0.985)`) | `ease` | `120ms` |
| Household pick (border, background, radio dot) | `ease` | `120ms` |
| Consent step entrance | `cubic-bezier(0.2, 0.7, 0.3, 1)` | `170ms` |
| Inline error text | `ease` on color only, no travel | `120ms` |
| Spinner | `linear` infinite | `800ms` |
| OTP caret blink | `steps(2, start)` infinite | `1100ms` |
| Landing narrative | `cubic-bezier(0.23, 1, 0.32, 1)` | `300–600ms` staged |

Every interactive UI transition stays **under 300ms**. Entrances use the
step curve or `--ease-out` so movement starts on the first frame; exit duration
is equal to or about 20% shorter than entry.

For narrative work, declare the curve once in the page's `:root`:

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
```

Do not add a token library for two pages.

### Scroll math

- **Pure timeline:** express scroll state as `timeline(progress)` with
  `progress ∈ [0, 1]`, clamped at both ends (`1 - 1e-9` for float noise), so
  scrolling backward reverses every stage without drift.
- **Programmatic glide:** cubic ease-out `1 - (1 - t) ** 3` over a
  distance-scaled `600–1200ms`.
- **Coalesce:** one `requestAnimationFrame` per scroll or resize burst, not one
  per event.

## 7. Interruption and state

- **Step switches use `hidden`.** The `.step` keyframe replays when a section is
  unhidden because `display: none` restarts CSS animation. Do not add JS mount
  flags.
- **Back and Forward land on the same step.** `popstate` restores through the
  same function that advances, and work that must survive a step change stays
  outside it: the consent resend clock keeps running across steps and stops only
  when the flow ends.
- **Motion never claims success early.** The spinner and `aria-busy` are the
  pending signal; the result is a state change after the request resolves, not
  a completion flash.
- **Manual input cancels programmatic scroll.** Listen for `wheel`,
  `touchstart`, and `keydown` with `{ passive: true }`, and guard against
  overlapping glides.
- **Reconciling lists:** if a page ever re-renders a list, cache the DOM node by
  key and replace only nodes whose state changed, so existing items keep their
  identity and do not replay entrance keyframes.

## 8. Reduced motion and input gating

Ship this in the same change as the motion:

- **`prefers-reduced-motion: reduce`:** disable the step entrance, make the
  spinner static, stop the caret blink, and remove transitions. The consent
  page's block is the model.
- **In JS:** check `matchMedia("(prefers-reduced-motion: reduce)").matches` and
  jump scroll glides directly with `scrollTo(0, to)`; reveal staged content
  immediately instead of scrubbing it.
- **Pointer gating:** gate movement on
  `@media (hover: hover) and (pointer: fine)`. Color-only hover is fine on
  touch.
- **`forced-colors: active`:** keep the borders that shadows and rings would
  otherwise carry.
- **Keyboard focus stays visible** on every state, including after a step
  change.

## Recipes

When building a concrete pattern — step entrance, field error, primary button
busy, household pick, OTP caret, invite CTA, landing scroll narrative, or an
interruptible glide — read [`RECIPES.md`](RECIPES.md) and start from the
matching recipe.

## Completion criterion

Every animation change is complete when the code is written and you report
these three items in at most 5 lines:

1. **Gate verdict:** frequency tier + one-word purpose (and any requested motion
   you rejected at the gate).
2. **Ingredients:** tool, animated properties, and exact curve/duration.
3. **Feel-check:** rapid re-trigger mid-flight, step Back/Forward, scroll
   reversal, `prefers-reduced-motion: reduce`, a 320px viewport with touch
   scrolling, keyboard-only focus, and a clean console under the page's CSP.
