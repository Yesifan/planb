import { LanguageModel, ToolLoopAgentSettings } from "ai";
import { describe, expect, test } from "bun:test";

import { createAgent, createReasoningProviderOptions } from "./agent";
import { createMockProvider } from "./mock-provider";
import { PlanbProvider } from "./type";

function getSettings(agent: unknown) {
  return (agent as unknown as { settings: ToolLoopAgentSettings }).settings;
}

function createProvider() {
  const provider = createMockProvider() as unknown as PlanbProvider;
  provider.models = () => [];
  return provider;
}

function createRecordingProvider() {
  const calls: Array<{
    modelId: LanguageModel;
  }> = [];
  const mockProvider = createMockProvider();
  const provider = ((modelId: LanguageModel) => {
    calls.push({ modelId });
    return mockProvider(modelId as never);
  }) as PlanbProvider;
  provider.models = () => [];
  return { provider, calls };
}

describe("createAgent", () => {
  const deepseekProvidersConfig = {
    deepseek: {
      npm: "@ai-sdk/deepseek" as const,
      name: "deepseek",
      models: { "deepseek-v4-pro": { name: "DeepSeek V4 Pro" } },
    },
  };

  const compatibleProvidersConfig = {
    doubao: {
      npm: "@ai-sdk/openai-compatible" as const,
      name: "doubao",
      models: { "glm-5.1": { name: "GLM 5.1" } },
    },
  };

  test("should choose reasoning provider options by provider npm package", () => {
    expect(
      createReasoningProviderOptions(
        "custom-reasoner/model-a",
        { enabled: false },
        {
          "custom-reasoner": {
            npm: "@ai-sdk/deepseek",
            name: "deepseek",
            models: { "model-a": { name: "Model A" } },
          },
        },
      ),
    ).toEqual({ deepseek: { thinking: { type: "disabled" } } });
  });

  test("should enable reasoning provider options when reasoning is enabled", () => {
    expect(
      createReasoningProviderOptions(
        "deepseek/deepseek-v4-pro",
        { enabled: true, effort: "high" },
        deepseekProvidersConfig,
      ),
    ).toEqual({
      deepseek: {
        thinking: { type: "enabled" },
        reasoningEffort: "high",
      },
    });
  });

  test("should disable reasoning provider options when reasoning is disabled", () => {
    expect(
      createReasoningProviderOptions(
        "deepseek/deepseek-v4-pro",
        { enabled: false },
        deepseekProvidersConfig,
      ),
    ).toEqual({ deepseek: { thinking: { type: "disabled" } } });
  });

  test("should treat reasoning effort as enabled reasoning", () => {
    expect(
      createReasoningProviderOptions(
        "doubao/glm-5.1",
        { effort: "medium" },
        compatibleProvidersConfig,
      ),
    ).toEqual({ doubao: { reasoningEffort: "medium" } });
  });

  test("should let runtime provider options override frontmatter reasoning options", () => {
    expect(
      getSettings(
        createAgent(
          "OverrideReasoning",
          createProvider(),
          {
            content: "system prompt",
            frontmatter: {
              description: "Reasoning agent.",
              model: "deepseek/deepseek-v4-pro",
              reasoning: { enabled: true, effort: "high" },
            },
          },
          { providerOptions: { deepseek: { reasoningEffort: "low" } } },
        ),
      ).providerOptions,
    ).toEqual({ deepseek: { reasoningEffort: "low" } });
  });

  test("should reject contradictory reasoning during agent creation", () => {
    expect(() =>
      createAgent("InvalidReasoning", createProvider(), {
        content: "system prompt",
        frontmatter: {
          description: "Invalid agent.",
          model: "doubao/glm-5.1",
          reasoning: { enabled: false, effort: "low" },
        },
      }),
    ).toThrow();
  });

  test("should disable compatible reasoning through provider options", () => {
    expect(
      createReasoningProviderOptions(
        "doubao/glm-5.1",
        { enabled: false },
        compatibleProvidersConfig,
      ),
    ).toEqual({
      doubao: {
        thinking: { type: "disabled" },
        reasoningEffort: "minimal",
      },
    });
  });

  test("should not pass reasoning to provider when creating the model", () => {
    const { provider, calls } = createRecordingProvider();

    createAgent("CompatibleNoReasoningProvider", provider, {
      content: "system prompt",
      frontmatter: {
        description: "Compatible fast agent.",
        model: "doubao/glm-5.1",
        reasoning: { enabled: false },
      },
    });

    expect(calls).toEqual([{ modelId: "doubao/glm-5.1" }]);
  });
});
