import { ProviderV3 } from "@ai-sdk/provider";
import { InferUITools, LanguageModel, UIDataTypes, UIMessage } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import z from "zod";

import { DB } from "../db";
import Tools from "./tool";

export type MyUITools = InferUITools<typeof Tools>;

export type AgentStatusChunk = {
  type: "agent-status";
  agentId: string;
  statusText: string;
};

export type AgentStatusChunkClear = {
  type: "agent-status";
  agentId: null;
};

export type AgentStatusEvent = AgentStatusChunk | AgentStatusChunkClear;

export type MyUIMessage = UIMessage<never, UIDataTypes, MyUITools> & {
  agentStatus?: { agentId: string; statusText: string } | null;
};

export type AgentId =
  | "Arbiter"
  | "Archivist"
  | "Chronicler"
  | "ExMachina"
  | "Oracle"
  | "Sentinel"
  | "System"
  | "Titler"
  | "Weaver"
  | (string & {});

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

export const AgentSchema = z.object({
  description: z.string(),
  model: z.string().optional(),
  temperature: z.number().max(1).min(0).optional(),
  tools: z.array(z.string()).optional(),
  stopWhen: z
    .object({
      hasToolCall: z.array(z.string()).optional(),
      maxStep: z.int().optional(),
    })
    .optional(),
  toolChoice: z.string().optional(),
});

export type Agent = z.infer<typeof AgentSchema>;

export interface MockProvider<
  IMAGE_MODEL_IDS extends string = string,
> extends Omit<ProviderV3, "imageModel"> {
  (modelId: IMAGE_MODEL_IDS): MockLanguageModelV3;
}

export interface PlanbProvider<
  IMAGE_MODEL_IDS extends LanguageModel = LanguageModel,
> extends Omit<ProviderV3, "imageModel"> {
  (modelId: IMAGE_MODEL_IDS): MockLanguageModelV3 | IMAGE_MODEL_IDS;

  models(): string[];
}

export interface ToolContext {
  db: DB;
  chatId: string;
  traceId?: string;
}

export interface LogContext {
  traceId: string;
  agentName: string;
  model?: string;
  chatId?: string;
}
