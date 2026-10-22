# Seeded ideas open into twists

Draft 2026-10-21. Amends spec 0001 (tapping a seeded idea) and ADR 9
(seeded deck).

## Problem

Tapping a seeded idea sends `Let's do <title> with <ingredients>.` The model
reads a named dish as a commitment and writes a Sketch. Every household gets
roughly the same Sketch for the same card, and the tap waits on a full chat
turn. A seeded idea is a starting point, not a finished recipe: the first
reply should offer directions to take it, fitted to the household, and it
should arrive fast.

## Experience

- The deck is unchanged: same ideas, art, and order. Out-of-season ideas
  sink to the bottom, in-season ones rise.
- Tapping an idea opens a chat whose first reply is a short hook and an
  `<ideas>` pager of 2–4 twists on that idea, adapted to the household's
  cuisines, avoidances, and shops. It renders and streams like any reply.
- From there the conversation is normal: tap a twist for a Sketch, or talk.

## Twist library

`apps/api/src/seeded-twists.json`, keyed by the seeded idea's title (the
same key `seeded-art.ts` uses):

```json
{
  "Pan-Seared Pork Chops with Jammy Zwetschgen (Plums)": [
    { "title": "…", "cuisine": "German", "pitch": "…" },
    { "title": "…", "cuisine": "Chinese", "pitch": "…" }
  ]
}
```

- 3–5 twists per idea, deliberately far apart: one per cuisine family, never
  two neighbours (Spanish and Portuguese). Adapting towards a neighbour is
  the model's job at tap time.
- Written offline and filled incrementally. An idea may have no entry.
- A table replaces the file only if file-based batches become a burden.

## Reply

The app sends the idea's title with the first message, next to
`entry: "idea"`. The pick text becomes `Give me a few directions for:
<title>` (the `dish` entry's grammar), so the transcript reads honestly
whichever path answers.

On the first message of a new chat with `entry = idea`:

- **Twists exist:** the API answers with `gemini-flash-lite-latest`, no
  tools. Its system prompt is the assistant prompt (for voice and the
  `<ideas>` format), `profileContext`, local time, and an adaptation brief
  carrying the twists. It picks 2–4,
  rewrites them lightly towards the household (Chinese → Japanese for a
  Japanese-cooking household, a dislike swapped out), keeps the assistant's
  voice, and returns a hook plus `<ideas>`. The reply goes through
  `createChatReply` like any turn: same persistence, same suggestions.
- **No twists, or the title is unknown:** the normal chat path. The pick
  text already asks for directions.

Every later turn uses the normal chat model, which sees the twist reply in
history like any assistant message. Nothing is stored per household.

## Testing

- API unit test at a pure seam (`seeded-twists.test.ts`): an idea with
  twists gets a brief carrying them; an unknown idea gets none and takes the
  normal path. The test stops short of calling Gemini; the device pass
  covers the real flash-lite reply.
- Device pass with the seeded login: tap an idea with twists, see the pager
  arrive quickly, tap a twist, get a Sketch. Tap one without twists, get
  directions from the normal path.

## Out of scope

- Generating or rewriting the seeded ideas themselves.
- Per-household ranking of the deck.
- Filtering twists by cuisine.
- Writing the twist content (done offline, outside this change).
