import {
  stepCountIs,
  type PrepareStepFunction,
  type StopCondition,
  type ToolSet,
} from "ai";

const WRAP_UP =
  "This reply has used all its steps, so you can't call tools now. Say briefly what's done and what's left, and offer to continue.";

/**
 * Caps a turn at `steps` model calls. The last one gets no tools, so a long
 * task ends with a summary the user can continue from instead of a failure.
 */
export function stepBudget<TOOLS extends ToolSet>(
  steps: number,
  system: string,
): { stopWhen: StopCondition<TOOLS>; prepareStep: PrepareStepFunction<TOOLS> } {
  return {
    stopWhen: stepCountIs(steps),
    prepareStep: ({ stepNumber }) =>
      stepNumber === steps - 1
        ? { toolChoice: "none", instructions: `${system}\n\n${WRAP_UP}` }
        : undefined,
  };
}
