import { LanguageModelV3Content } from "@ai-sdk/provider";
import { LanguageModel } from "ai";
import { MockLanguageModelV3 } from "ai/test";

import { MockProvider } from "./type";

export function createMockProvider<CHAT_MODEL_IDS extends LanguageModel>() {
  const defaultMock = new MockLanguageModelV3({
    doGenerate: async (options) => {
      let content: LanguageModelV3Content = {
        type: "text",
        text: `Hello, world!`,
      };

      if (options.prompt.find((message) => message.role === "tool")) {
        content = {
          type: "text",
          text: `Tool Call Success!`,
        };
      } else if (
        options.tools?.find((tool) => tool.name === "updateSessionTitle")
      ) {
        content = {
          type: "tool-call",
          toolCallId: "updateSessionTitle_MOCK",
          toolName: "updateSessionTitle",
          input: JSON.stringify({ title: "Mock Title" }),
        };
      }
      return {
        content: [content],
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
      };
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const provider = (_modelId: CHAT_MODEL_IDS) => {
    return defaultMock;
  };

  return provider as MockProvider;
}
