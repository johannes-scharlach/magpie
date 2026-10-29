import type { GenerateTextStepEndEvent, LanguageModelCallStartEvent } from "ai";

/** The first call is the turn's historical input; later tool results live in chat_messages. */
export function captureChatGenerationContext(opts: {
  historyMessageIds: string[];
  build: string | null;
  save: (context: string) => Promise<void>;
}) {
  let initial: string | undefined;
  async function save(context: string) {
    try {
      await opts.save(context);
    } catch (error) {
      console.error("chat generation context capture failed", error);
    }
  }

  return {
    onLanguageModelCallStart: async (event: LanguageModelCallStartEvent) => {
      if (initial !== undefined) return;
      // Pick model input explicitly: transport headers, credentials and executable
      // tool implementations have no place in a retrospective snapshot.
      initial = JSON.stringify({
        version: 1,
        build: opts.build,
        historyMessageIds: opts.historyMessageIds,
        input: {
          provider: event.provider,
          modelId: event.modelId,
          instructions: event.instructions,
          messages: event.messages,
          tools: event.tools,
          reasoning: event.reasoning,
          maxOutputTokens: event.maxOutputTokens,
          temperature: event.temperature,
          topP: event.topP,
          topK: event.topK,
          presencePenalty: event.presencePenalty,
          frequencyPenalty: event.frequencyPenalty,
          stopSequences: event.stopSequences,
          seed: event.seed,
        },
      });
      await save(initial);
    },
    onStepEnd: async ({
      stepNumber,
      response,
    }: Pick<GenerateTextStepEndEvent, "stepNumber" | "response">) => {
      if (stepNumber !== 0 || initial === undefined) return;
      await save(
        JSON.stringify({
          ...JSON.parse(initial),
          response: {
            id: response.id,
            modelId: response.modelId,
            timestamp: response.timestamp,
          },
        }),
      );
    },
  };
}
