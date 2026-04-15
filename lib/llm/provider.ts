import {
  createOpenAICompatible,
  OpenAICompatibleProvider,
} from "@ai-sdk/openai-compatible";
import { LanguageModel, NoSuchModelError, InvalidArgumentError } from "ai";
import { createMockProvider } from "./mock-provider";
import { Provider, MockProvider, PlanbProvider } from "./type";

export function createPlanbCompatible<IMAGE_MODEL_IDS extends LanguageModel>(
  providersConfig: Record<string, Provider>,
) {
  const providers = Object.entries(providersConfig).reduce<
    Record<string, OpenAICompatibleProvider | MockProvider>
  >((acc, [key, provider]) => {
    let aiProvider = null;
    if (provider.npm === "@ai-sdk/openai-compatible") {
      aiProvider = createOpenAICompatible({
        name: provider.name,
        apiKey: provider?.options?.apiKey,
        baseURL: provider?.options?.baseURL ?? "",
        includeUsage: true, // Include usage information in streaming responses
      });
    } else if (provider.npm === "ai/test") {
      aiProvider = createMockProvider();
    }
    if (aiProvider) {
      acc[key] = aiProvider;
    }

    return acc;
  }, {});

  const planbProvider = (modelId: IMAGE_MODEL_IDS) => {
    if (typeof modelId === "string") {
      const [providerName, modelName] = modelId.split("/");
      const provider = providers[providerName];
      const providerConfig = providersConfig[providerName];
      const model = providerConfig?.models[modelName];

      if (provider) {
        if (model) {
          return provider(modelName);
        } else {
          throw new NoSuchModelError({
            modelId: modelName,
            modelType: "languageModel",
            message: `Model "${modelName}" not found in provider "${providerName}"`,
          });
        }
      } else {
        throw new InvalidArgumentError({
          parameter: "model",
          value: modelId,
          message: `Provider "${providerName}" not found or not configured`,
        });
      }
    }
    return modelId;
  };

  planbProvider.models = () => {
    return Object.entries(providersConfig).flatMap(([key, provider]) => {
      return Object.keys(provider.models).map((model) => `${key}/${model}`);
    });
  };

  return planbProvider as PlanbProvider<IMAGE_MODEL_IDS>;
}
