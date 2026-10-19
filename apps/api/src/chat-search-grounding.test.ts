import test from "node:test";
import assert from "node:assert/strict";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";

type GeminiPayloadTool = {
  googleSearch?: Record<string, unknown>;
  functionDeclarations?: Array<{ name: string; description?: string }>;
};

type GeminiRequestBody = {
  tools?: GeminiPayloadTool[];
};

test("stock @ai-sdk/google sends concurrent search grounding and custom tools for gemini-flash-latest", async () => {
  const captured: { body?: GeminiRequestBody } = {};

  const mockPayload = {
    candidates: [
      {
        content: {
          role: "model",
          parts: [{ text: "Here is your grounded answer." }],
        },
        finishReason: "STOP",
        groundingMetadata: {
          webSearchQueries: ["in-season asparagus recipes"],
          groundingChunks: [
            {
              web: {
                uri: "https://example.com/asparagus",
                title: "Asparagus Season",
              },
            },
          ],
        },
      },
    ],
    usageMetadata: {
      promptTokenCount: 15,
      candidatesTokenCount: 25,
      totalTokenCount: 40,
    },
  };

  const mockFetch: typeof fetch = async (url, init) => {
    captured.body = JSON.parse(init?.body as string) as GeminiRequestBody;

    const isSse = String(url).includes("alt=sse");
    const body = isSse
      ? `data: ${JSON.stringify(mockPayload)}\r\n\r\n`
      : JSON.stringify(mockPayload);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": isSse ? "text/event-stream" : "application/json",
      },
    });
  };

  const google = createGoogleGenerativeAI({
    apiKey: "test-api-key",
    fetch: mockFetch,
  });

  // Test streaming as used in routes/chats.ts
  const streamResult = streamText({
    model: google("gemini-flash-latest"),
    prompt: "What produce is in season?",
    tools: {
      googleSearch: google.tools.googleSearch({}),
      addToCookbook: tool({
        description: "Save a recipe",
        inputSchema: z.object({ title: z.string() }),
        execute: async ({ title }) => ({ saved: true, title }),
      }),
    },
    stopWhen: stepCountIs(5),
  });

  const text = await streamResult.text;
  assert.equal(text, "Here is your grounded answer.");

  // Verify the payload sent to Google
  assert.ok(captured.body?.tools);
  const tools = captured.body.tools;
  const googleSearchTool = tools.find((t) => t.googleSearch !== undefined);
  const functionDeclarationsTool = tools.find(
    (t) => t.functionDeclarations !== undefined,
  );

  assert.ok(googleSearchTool, "tools payload must include googleSearch");
  assert.ok(
    functionDeclarationsTool,
    "tools payload must include functionDeclarations alongside googleSearch",
  );
  assert.equal(
    functionDeclarationsTool.functionDeclarations?.[0]?.name,
    "addToCookbook",
  );

  // Verify no unsupported warnings occurred
  const warnings = (await streamResult.warnings) ?? [];
  const unsupportedWarnings = warnings.filter((w) => w.type === "unsupported");
  assert.equal(
    unsupportedWarnings.length,
    0,
    `Should have 0 unsupported tool warnings, got: ${JSON.stringify(unsupportedWarnings)}`,
  );
});
