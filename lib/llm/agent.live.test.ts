import { readFileSync } from "node:fs";

import type { GenerateTextResult, Output, ToolSet } from "ai";
import { describe, expect, test } from "bun:test";
import { load } from "js-yaml";

import type { AgentReasoning } from "./type";

const runLiveTests = process.env.RUN_LIVE_LLM_TESTS === "1";
const liveTest = runLiveTests ? test : test.skip;
const liveSettingsPath = process.env.LIVE_PLANB_SETTINGS_PATH ?? "planb.yml";

function getReasoningText(
  result: Pick<
    GenerateTextResult<ToolSet, Output.Output>,
    "reasoning" | "reasoningText"
  >,
) {
  const fromReasoningText = result.reasoningText?.trim() ?? "";
  const fromReasoning = result.reasoning
    .map(({ text }) => text)
    .join("")
    .trim();
  const text = fromReasoningText || fromReasoning;

  return text;
}

async function generateWithReasoning({
  modelId,
  label,
  reasoning,
}: {
  modelId: string;
  label: "disabled" | "low" | "high";
  reasoning: AgentReasoning;
}) {
  process.env.PLANB_SETTINGS_PATH = liveSettingsPath;

  const [{ createAgent }, { provider }] = await Promise.all([
    import("./agent"),
    import("./provider"),
  ]);

  const result = await createAgent(label, provider, {
    content:
      "You are a reasoning capability test agent. Solve carefully, but final answer must be concise.",
    frontmatter: {
      description: "Live reasoning test agent.",
      model: modelId,
      temperature: 0,
      reasoning,
    },
  }).generate({
    prompt:
      "A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. What does the ball cost? Answer with only the amount.",
    timeout: 60_000,
  });

  return result;
}

const modelIds = (() => {
  if (!runLiveTests) {
    return [];
  }

  const parsed = load(readFileSync(liveSettingsPath, "utf-8")) as {
    provider?: Record<string, { models?: Record<string, unknown> }>;
  };

  return Object.entries(parsed.provider ?? {}).flatMap(
    ([providerName, providerConfig]) => {
      const firstModel = Object.keys(providerConfig.models ?? {})[0];
      return firstModel ? [`${providerName}/${firstModel}`] : [];
    },
  );
})();

describe("createAgent live reasoning", () => {
  if (modelIds.length === 0) {
    liveTest("should find live provider models", () => {
      expect(modelIds.length).toBeGreaterThan(0);
    });
  }

  for (const modelId of modelIds) {
    describe(modelId, () => {
      liveTest(
        "should not return reasoning when reasoning is disabled",
        async () => {
          const disabled = await generateWithReasoning({
            modelId,
            label: "disabled",
            reasoning: { enabled: false },
          });

          expect(
            getReasoningText(disabled).length,
            `${modelId} disabled reasoning`,
          ).toBe(0);
        },
        60_000,
      );

      liveTest(
        "should return longer reasoning when effort is high than low",
        async () => {
          const low = await generateWithReasoning({
            modelId,
            label: "low",
            reasoning: { effort: "low" },
          });
          const high = await generateWithReasoning({
            modelId,
            label: "high",
            reasoning: { effort: "high" },
          });

          expect(
            getReasoningText(low).length,
            `${modelId} low reasoning`,
          ).toBeGreaterThan(0);

          expect(
            getReasoningText(high).length,
            `${modelId} high reasoning`,
          ).toBeGreaterThan(getReasoningText(low).length);
        },
        120_000,
      );
    });
  }
});

describe("sentinel reasoning", () => {
  liveTest(
    "should not return reasoning when real sentinel disables reasoning",
    async () => {
      process.env.PLANB_SETTINGS_PATH = liveSettingsPath;

      const { sentinel } = await import("@/lib/llm");
      const result = await sentinel.generate({
        prompt: "主角谨慎地继续向前侦查。",
        timeout: 60_000,
      });

      console.log("output", result.text);
      console.log("toolCalls", result.toolCalls);
      console.log("reasoning", result.reasoning);

      expect(
        getReasoningText(result).length,
        `${sentinel.id} no reasoning`,
      ).toBe(0);
    },
    60_000,
  );
});
