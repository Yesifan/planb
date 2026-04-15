import { MockLanguageModelV3 } from "ai/test";

import { LanguageModel } from "ai";
import { MockProvider } from "./type";

export function createMockProvider<CHAT_MODEL_IDS extends LanguageModel>() {
  const defaultMock = new MockLanguageModelV3({
    doGenerate: async () => ({
      content: [{ type: "text", text: `Hello, world!` }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: {
          total: 10,
          noCache: 10,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: {
          total: 20,
          text: 20,
          reasoning: undefined,
        },
      },
      warnings: [],
    }),
  });
  const provider = (modelId: CHAT_MODEL_IDS) => {
    return defaultMock;
  };

  return provider as MockProvider;
}
