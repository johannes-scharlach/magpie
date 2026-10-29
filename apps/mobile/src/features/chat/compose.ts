import {
  formatExtraPortions,
  joinNames,
  whoIsEating,
  type Eater,
} from "@/features/meals/eaters";
import {
  addDays,
  dateKey,
  SLOT_LABEL,
  WEEKDAY_LONG,
  type MealSlot,
} from "@/features/meals/slots";
import {
  axes,
  type Dinner,
  type Marks,
} from "@/features/dinner-turntable/game";

/**
 * The app never puts words in the user's mouth: everything it sends in
 * their name is assembled here from what they actually entered, and these
 * functions are the tested seam for that rule.
 */

/** Home entry: chips plus any unfinished input (images may accompany).
 *  Ingredients lowercased so the sentence reads plain. */
export function entryMessage(
  chips: string[],
  attachmentCount: number,
  draft: string,
): string {
  const ingredients = draft.trim() ? [...chips, draft.trim()] : chips;
  const names = ingredients.map((chip) => chip.toLowerCase());
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  if (attachmentCount && names.length) return `I also have ${list}.`;
  if (names.length) return `I have ${list}.`;
  return attachmentCount > 1
    ? "What could I make with what's in these photos?"
    : "What could I make with what's in this photo?";
}

export function dishMessage(dish: string): string {
  return `Give me a few ideas for making: ${dish.trim()}`;
}

/** The turntable has already chosen a direction; don't open another idea deck. */
export function cookDinnerMessage(dinner: Dinner, marks: Marks): string {
  const choices = (mode: "keep" | "avoid") =>
    axes.flatMap(({ id, name }) => {
      const mark = marks[id];
      return mark?.mode === mode
        ? [`${mark.value} (${name.toLowerCase()})`]
        : [];
    });
  const kept = choices("keep");
  const avoided = choices("avoid");
  return [
    `Show me how to make: ${dinner.title}.`,
    dinner.pitch,
    dinner.ingredients ? `Ingredients: ${dinner.ingredients}.` : "",
    kept.length ? `Keep: ${kept.join(", ")}.` : "",
    avoided.length ? `Rule out: ${avoided.join(", ")}.` : "",
    "Expand this dinner rather than offering more ideas.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Planning entry: dates stay explicit when the conversation is resumed later. */
export function mealPlanMessage(opts: {
  slots: { day: string; meal: MealSlot }[];
  notes: string;
  attachmentCount: number;
}): string {
  const meals = opts.slots.map(
    ({ day, meal }) => `- ${day}: ${SLOT_LABEL[meal].toLowerCase()}`,
  );
  return [
    "Help me draft a meal plan for these meals:",
    ...meals,
    opts.notes.trim(),
    opts.attachmentCount === 1 ? "I've attached an image." : "",
    opts.attachmentCount > 1 ? "I've attached some images." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Day named the way the user saw it on the strip: today, tomorrow,
 *  otherwise the weekday; further out adds the date. */
export function dayName(key: string, today: Date = new Date()): string {
  const todayKey = dateKey(today);
  const tomorrowKey = dateKey(addDays(today, 1));
  if (key === todayKey) return "today";
  if (key === tomorrowKey) return "tomorrow";
  const d = new Date(`${key}T12:00:00`);
  const weekday = WEEKDAY_LONG[d.getDay()] ?? key;
  const daysOut = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  return daysOut > 6 ? `${weekday} ${d.getDate()}` : weekday;
}

/** Plan sheet confirm: the full ask, verbatim from the form's choices. The
 *  assistant sizes the recipe it writes for exactly these eaters and extra,
 *  so the names must be the ones it knows from the household. */
export function saveAndPlanMessage(
  opts: {
    day: string;
    meal: MealSlot;
    people: Eater[];
    eaterIds: string[];
    extraPortions: number;
  },
  today: Date = new Date(),
): string {
  const slot = SLOT_LABEL[opts.meal].toLowerCase();
  const { eating, everyone } = whoIsEating(opts.people, opts.eaterIds);
  const who = everyone
    ? "everyone"
    : eating.length
      ? joinNames(eating.map((p) => (p.self ? "me" : p.name)))
      : "nobody from the household";
  const extra =
    opts.extraPortions > 0
      ? `, plus ${formatExtraPortions(opts.extraPortions)} extra ${opts.extraPortions === 1 ? "portion" : "portions"}`
      : "";
  return `Save this and plan it for ${dayName(opts.day, today)} ${slot}. Eating: ${who}${extra}.`;
}

/** A recipe told from memory. Started from a meal slot, it asks for that
 *  slot too, since the chat confirms and saves before it can plan. */
export function toldRecipeMessage(
  plan?: { date: string; slot: MealSlot },
  today: Date = new Date(),
): string {
  const told = "Here's a recipe I know.";
  if (!plan) return told;
  const slot = SLOT_LABEL[plan.slot].toLowerCase();
  return `${told} Once it's saved, plan it for ${dayName(plan.date, today)} ${slot}.`;
}

/** Adjust is an explicit request assembled from the meal the user can see. */
export function adjustRecipeMessage(opts: {
  date: string;
  meal: string;
  people: Eater[];
  eaterIds: string[];
  extraPortions: number;
  /** A null `to` goes without the ingredient. */
  swaps: { from: string; to: string | null }[];
}): string {
  const names = opts.people
    .filter((person) => opts.eaterIds.includes(person.id))
    .map((person) => (person.self ? "me" : person.name));
  return [
    `Write a variant for ${opts.date} ${opts.meal}.`,
    `Eating: ${joinNames(names) || "nobody from the household"}${opts.extraPortions ? `, plus ${formatExtraPortions(opts.extraPortions)} extra portions` : ""}.`,
    ...opts.swaps.map((swap) =>
      swap.to === null
        ? `Leave out the ${swap.from}.`
        : `Use ${swap.to} instead of ${swap.from}.`,
    ),
    "Size the recipe for these eaters and fold the shopping list's swaps into the ingredients and steps.",
  ].join("\n");
}
