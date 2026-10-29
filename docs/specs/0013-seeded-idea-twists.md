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

`packages/meals/src/seeded-twists.json`, keyed by the seeded idea's title (the
same key `seeded-art.ts` uses):

```json
{
  "Pan-Seared Pork Chops with Jammy Zwetschgen (Plums)": [
    {
      "title": "Schweinekotelett with Zwetschgen, mustard and buttered Spätzle",
      "cuisine": "German",
      "pitch": "Plums collapsed right in the pan juices with coarse mustard and fresh thyme. Rich, sweet-tart pan sauce over tender, butter-tossed Spätzle."
    },
    {
      "title": "Pork chops with balsamic plums, crisp sage and soft polenta",
      "cuisine": "Italian",
      "pitch": "Fresh sage leaves crackled in foaming butter, plums caramelized with a splash of balsamic into a glossy glaze. Spooned over warm, creamy polenta."
    }
  ]
}
```

- **3–4 strong, appetizing twists per idea.** Better to offer 3 clear,
  mouthwatering directions than 5 confused ones.
- **Weeknight simplicity:** Aim for <5 ingredients (excluding basic pantry
  staples like oil, salt, pepper, water, butter, rice, tortillas) and under 30
  minutes. Pragmatic home cooking, not weekend projects.
- **Natural over forced technique:** Don't force artificial equipment or
  process variety for its own sake. If the parent idea is a skillet dish, its
  twists can all be skillet dishes. Spacing comes from flavor profile, cuisine
  tradition, and table accompaniments.
- **Cuisine coverage & authentic markers:** Cuisines come from the app's
  supported catalog (`packages/profile`). Never pair immediate neighbors
  (Spanish and Portuguese, Cantonese and Taiwanese) for the same idea.
  Adventurous directions are a floor, not a ceiling: explore freely where
  natural. For dishes deeply rooted in a single culinary tradition (such as
  pasta), draw on distinct regional styles (e.g. Roman, Calabrian, Sicilian,
  Neapolitan) rather than forcing awkward cross-border fusion. Ground each
  twist in genuine culinary markers (e.g., Shaoxing wine deglaze, Spätzle,
  sage in foaming butter, chipotle in adobo with Mexican oregano) rather than
  generic fusion.
- **Titles implicitly signal cuisine:** When ideas spread across cuisines, make
  each cuisine 100% recognizable in the title itself through its authentic
  ingredients and dish framing (_Calabacitas con elote_, _Warm feta and mint_,
  _Crisp sage and polenta_), rather than explicitly labeling the cuisine in the
  title.
- **Voice:** Anchored in the assistant prompt (`apps/api/src/assistant-prompt.ts`):
  the skilled friend on the phone. Actionable sensory mechanics, dinner
  logistics (what catches the juices, what's on the side), no lifestyle tags
  or marketing copy, no exclamation marks or emojis.
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
