import assert from "node:assert/strict";
import { test } from "node:test";
import { streamText, tool } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";

import { createChatReply, type AssistantUIMessage } from "./chat-reply.js";
import { stepBudget } from "./step-budget.js";

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

test("a turn that runs out of steps ends with a summary, not a failure", async () => {
  let reply: AssistantUIMessage | undefined;
  let lastPrompt = "";
  const saved: string[] = [];
  // Keeps planning while it may call tools, like a long week plan.
  const model = new MockLanguageModelV4({
    doStream: async ({ toolChoice, prompt }) => {
      lastPrompt = JSON.stringify(prompt);
      const parts =
        toolChoice?.type === "none"
          ? [
              { type: "text-start", id: "text" },
              { type: "text-delta", id: "text", delta: "Saved 2 of 5." },
              { type: "text-end", id: "text" },
              {
                type: "finish",
                finishReason: { unified: "stop", raw: "STOP" },
                usage,
              },
            ]
          : [
              {
                type: "tool-call",
                toolCallId: `save-${saved.length}`,
                toolName: "addToCookbook",
                input: "{}",
              },
              {
                type: "finish",
                finishReason: { unified: "tool-calls", raw: "STOP" },
                usage,
              },
            ];
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            for (const part of parts) controller.enqueue(part as never);
            controller.close();
          },
        }),
      };
    },
  });
  const tools = {
    addToCookbook: tool({
      inputSchema: z.object({}),
      execute: async () => {
        saved.push("recipe");
        return { variantId: "saved" };
      },
    }),
  };
  const response = createChatReply({
    id: "reply",
    userMessageId: "question",
    request: new AbortController().signal,
    run: async () =>
      streamText({
        model,
        system: "You are Magpie.",
        prompt: "Plan my week",
        tools,
        ...stepBudget<typeof tools>(3, "You are Magpie."),
      }),
    suggestions: async () => ["Continue with the rest"],
    save: async (message) => {
      reply = structuredClone(message);
    },
    notify: async () => {},
  });

  await response.text();
  assert.ok(reply);
  assert.deepEqual(
    reply.parts.find((part) => part.type === "data-turn")?.data,
    { userMessageId: "question", status: "completed" },
  );
  assert.equal(saved.length, 2);
  assert.ok(
    reply.parts.some(
      (part) => part.type === "text" && part.text === "Saved 2 of 5.",
    ),
  );
  assert.ok(lastPrompt.includes("You are Magpie."));
  assert.ok(lastPrompt.includes("offer to continue"));
});
