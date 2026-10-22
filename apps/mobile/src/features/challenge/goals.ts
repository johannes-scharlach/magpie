/**
 * The first-run challenge (spec 0011): five imports make the cookbook yours,
 * and each other way into a meal is tried once. Suggest the couch-friendly
 * explorations first; completing anything out of order still counts.
 */
export type ChallengeCounts = {
  import: number;
  on_hand: number;
  dish: number;
  idea: number;
  recipeChats: number;
};

export type ChallengeGoal = {
  key: "import" | "on_hand" | "dish" | "idea" | "recipe_chat";
  label: string;
  invitation: string;
  cue: string;
  count: number;
  target: number;
  done: boolean;
};

const GOALS: Omit<ChallengeGoal, "count" | "done">[] = [
  {
    key: "idea",
    label: "Start from an idea",
    invitation: "Take an idea in your own direction",
    cue: "Pick an idea below. Work out your version with Magpie, then save it.",
    target: 1,
  },
  {
    key: "recipe_chat",
    label: "Chat about a recipe",
    invitation: "Adapt a recipe to suit you",
    cue: "Open a recipe in Cookbook and work out a change with Magpie—swap an ingredient, adjust the portions, or try another method.",
    target: 1,
  },
  {
    key: "dish",
    label: "Try a dish you have in mind",
    invitation: "Work out your version of a dish",
    cue: "Choose “Dish in mind” under Spontaneous meal. Tell Magpie what you’d like to make, shape the recipe together, then save it.",
    target: 1,
  },
  {
    key: "on_hand",
    label: "Try ingredients you have",
    invitation: "Turn what you have into a meal",
    cue: "Add ingredients under Spontaneous meal. Work out what you’d enjoy making with Magpie, then save your recipe.",
    target: 1,
  },
  {
    key: "import",
    label: "Import 5 recipes you love to cook",
    invitation: "Plan around meals you already love",
    cue: "Add five go-to recipes in Cookbook. They give you and Magpie familiar starting points for shaping your week.",
    target: 5,
  },
];

export function challengeGoals(counts: ChallengeCounts): {
  goals: ChallengeGoal[];
  featured: ChallengeGoal | null;
  completedCount: number;
  complete: boolean;
} {
  const goals = GOALS.map((goal) => {
    const raw =
      goal.key === "recipe_chat" ? counts.recipeChats : counts[goal.key];
    const count = Math.min(raw, goal.target);
    return { ...goal, count, done: count === goal.target };
  });
  const featured = goals.find((goal) => !goal.done) ?? null;
  return {
    goals,
    featured,
    completedCount: goals.filter((goal) => goal.done).length,
    complete: featured === null,
  };
}
