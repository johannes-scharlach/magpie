import { describe, expect, it } from "vitest";
import { challengeGoals } from "./goals";

const none = { import: 0, on_hand: 0, dish: 0, idea: 0, recipeChats: 0 };

describe("first-run challenge", () => {
  it("asks for five imports and one of each other way in", () => {
    const { goals, complete } = challengeGoals({
      ...none,
      import: 4,
      on_hand: 1,
      dish: 1,
      idea: 1,
      recipeChats: 1,
    });
    expect(goals.map((g) => [g.key, g.count, g.target, g.done])).toEqual([
      ["idea", 1, 1, true],
      ["recipe_chat", 1, 1, true],
      ["dish", 1, 1, true],
      ["on_hand", 1, 1, true],
      ["import", 4, 5, false],
    ]);
    expect(complete).toBe(false);
  });

  it("is complete once every goal is met, and never counts past a target", () => {
    const { goals, complete } = challengeGoals({
      import: 9,
      on_hand: 3,
      dish: 1,
      idea: 2,
      recipeChats: 4,
    });
    expect(goals.map((g) => g.count)).toEqual([1, 1, 1, 1, 5]);
    expect(complete).toBe(true);
  });

  it("starts with an idea, then features the next unfinished exploration", () => {
    expect(challengeGoals(none).featured?.key).toBe("idea");
    const next = challengeGoals({ ...none, idea: 1, dish: 1, import: 2 });
    expect(next.featured?.key).toBe("recipe_chat");
    expect(next.completedCount).toBe(2);
    expect(next.goals.find((goal) => goal.key === "import")?.count).toBe(2);
  });

  it("has no next task once all five goals are met", () => {
    const result = challengeGoals({
      import: 5,
      on_hand: 1,
      dish: 1,
      idea: 1,
      recipeChats: 1,
    });
    expect(result.featured).toBeNull();
    expect(result.completedCount).toBe(5);
  });
});
