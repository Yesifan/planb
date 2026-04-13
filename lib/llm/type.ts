import z from "zod";
import { OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";
import { MockLanguageModelV3 } from "ai/test";

export const NPM_PROVIDER = ["@ai-sdk/openai-compatible", "ai/test"] as const;
export const NpmProviderSchema = z.enum(NPM_PROVIDER);

export const ModelSchema = z.object({
  name: z.string(),
});
export type Model = z.infer<typeof ModelSchema>;

export const ProviderSchema = z.object({
  npm: NpmProviderSchema.optional(),
  name: z.string(),
  options: z
    .object({
      apiKey: z.string().optional(),
      baseURL: z.string().optional(),
    })
    .optional(),
  models: z.record(z.string(), ModelSchema),
});
export type Provider = z.infer<typeof ProviderSchema>;

export const LLMConfigSchema = z.object({
  primaryModel: z.string(),
  secondaryModel: z.string().optional(),
  provider: z.record(z.string(), ProviderSchema),
});
export type LLMConfig = z.infer<typeof LLMConfigSchema>;

export type AIProvider =
  // | LanguageModel
  OpenAICompatibleProvider | ((model?: string) => MockLanguageModelV3);
