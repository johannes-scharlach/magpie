import assert from "node:assert/strict";
import { test } from "node:test";
import { stepCountIs, streamText, tool } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";

import { captureChatGenerationContext } from "./chat-generation-context.js";

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

test("captures the initial model input before generation and keeps it across tool steps", async () => {
  const saved: string[] = [];
  const historyIds = ["question"];
  const capture = captureChatGenerationContext({
    historyMessageIds: historyIds,
    build: "test-build",
    save: async (context) => {
      saved.push(context);
    },
  });
  const model = new MockLanguageModelV4({
    doStream: async () => {
      assert.ok(saved.length, "context must be saved before the model runs");
      const firstStep = model.doStreamCalls.length === 1;
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            controller.enqueue({
              type: "response-metadata",
              id: `response-${model.doStreamCalls.length}`,
              modelId: "resolved-model-version",
              timestamp: new Date("2026-10-29T12:00:00Z"),
            });
            if (firstStep) {
              controller.enqueue({
                type: "tool-call",
                toolCallId: "read",
                toolName: "readVariant",
                input: '{"id":"variant"}',
              });
            } else {
              controller.enqueue({ type: "text-start", id: "text" });
              controller.enqueue({
                type: "text-delta",
                id: "text",
                delta: "Dinner.",
              });
              controller.enqueue({ type: "text-end", id: "text" });
            }
            controller.enqueue({
              type: "finish",
              finishReason: {
                unified: firstStep ? "tool-calls" : "stop",
                raw: "STOP",
              },
              usage,
            });
            controller.close();
          },
        }),
      };
    },
  });
  const result = streamText({
    model,
    system: "Household portions: 1 + 1 + 0.5.",
    messages: [{ role: "user", content: "Save dinner for everyone." }],
    reasoning: "low",
    headers: { Authorization: "secret-transport-header" },
    tools: {
      readVariant: tool({
        description: "Read the actual recipe",
        inputSchema: z.object({ id: z.string() }),
        execute: async () => {
          historyIds.push("later-message");
          return { name: "Pasta" };
        },
      }),
    },
    stopWhen: stepCountIs(2),
    ...capture,
  });

  assert.equal(await result.text, "Dinner.");
  assert.equal(
    saved.length,
    2,
    "initial snapshot plus first response metadata",
  );
  const context = JSON.parse(saved[1]!);
  assert.equal(context.version, 1);
  assert.equal(context.build, "test-build");
  assert.deepEqual(context.historyMessageIds, ["question"]);
  assert.equal(context.input.instructions, "Household portions: 1 + 1 + 0.5.");
  assert.deepEqual(context.input.messages, [
    { role: "user", content: "Save dinner for everyone." },
  ]);
  assert.equal(context.input.reasoning, "low");
  assert.equal(context.input.tools[0].name, "readVariant");
  assert.equal(context.input.tools[0].inputSchema.properties.id.type, "string");
  assert.equal(context.response.modelId, "resolved-model-version");
  assert.equal(context.response.id, "response-1");
  assert.ok(saved.every((json) => !json.includes("secret-transport-header")));
});

test("a capture storage failure does not fail the reply", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  const capture = captureChatGenerationContext({
    historyMessageIds: [],
    build: null,
    save: async () => {
      throw new Error("context store unavailable");
    },
  });
  const result = streamText({
    prompt: "Dinner?",
    model: new MockLanguageModelV4({
      doStream: {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            controller.enqueue({ type: "text-start", id: "text" });
            controller.enqueue({
              type: "text-delta",
              id: "text",
              delta: "Pasta.",
            });
            controller.enqueue({ type: "text-end", id: "text" });
            controller.enqueue({
              type: "finish",
              finishReason: { unified: "stop", raw: "STOP" },
              usage,
            });
            controller.close();
          },
        }),
      },
    }),
    ...capture,
  });
  assert.equal(await result.text, "Pasta.");
  assert.ok(log.mock.callCount() > 0);
});
