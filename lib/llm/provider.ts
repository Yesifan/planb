import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { AIProvider, Provider } from "./type";
import { MockLanguageModelV3 } from "ai/test";

export const createAIProvider = (providerConfig: Record<string, Provider>) => {
  return Object.entries(providerConfig).reduce<Record<string, AIProvider>>(
    (acc, [key, provider]) => {
      let aiProvider = null;
      if (provider.npm === "@ai-sdk/openai-compatible") {
        aiProvider = createOpenAICompatible({
          name: provider.name,
          apiKey: provider?.options?.apiKey,
          baseURL: provider?.options?.baseURL ?? "",
          includeUsage: true, // Include usage information in streaming responses
        });
      } else if (provider.npm === "ai/test") {
        aiProvider = () =>
          new MockLanguageModelV3({
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
      }
      if (aiProvider) {
        acc[key] = aiProvider;
      }

      return acc;
    },
    {},
  );
};
