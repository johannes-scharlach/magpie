import {
  cuisineLabel,
  cuisineOptions,
  habitDaysLabel,
  type DayHabit,
} from "@magpie/profile";

/** Kinds of dish to start from before the cookbook has its own words. */
export const habitStarters = [
  "pizza",
  "pasta",
  "curry",
  "soup",
  "stir-fry",
  "salad",
  "bake",
  "tacos",
  "fish",
  "burgers",
  "noodles",
  "cake",
];

export type HabitChoice = { what: string; label: string; recipes?: number };

/** The cookbook's own cuisines and tags by how many recipes have them, then
 *  the cuisines they cook, then the starter list. One spelling per word. */
export function habitChoices(
  cookbook: { what: string; recipes: number }[],
  cuisines: string[],
): HabitChoice[] {
  const seen = new Set<string>();
  const choices: HabitChoice[] = [];
  const add = (what: string, recipes?: number) => {
    const label = cuisineLabel(what);
    const key = label.toLocaleLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    choices.push(
      recipes === undefined ? { what, label } : { what, label, recipes },
    );
  };
  for (const { what, recipes } of [...cookbook].sort(
    (a, b) => b.recipes - a.recipes,
  ))
    add(what, recipes);
  for (const cuisine of cuisines) add(cuisine);
  for (const starter of habitStarters) add(starter);
  return choices;
}

const daysPhrase: Record<string, string> = {
  "Every day": "every day",
  Weekdays: "on weekdays",
  Weekend: "at the weekend",
};

export function habitConsequence({ days, meal, what }: DayHabit): string {
  const thing =
    what in cuisineOptions ? `something ${cuisineLabel(what)}` : what;
  const label = habitDaysLabel(days);
  const when = daysPhrase[label] ?? `on ${label}`;
  const slot = meal === "treat" ? "the treat" : meal;
  return `Magpie plans ${thing} for ${slot} ${when}.`;
}
