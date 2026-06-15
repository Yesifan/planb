import type { LanguageModelUsage, StepResult, ToolSet } from "ai";

import logger from "../logger";

type AgentLogDetail = "summary" | "full";

type FinishLogSource = {
  finishReason?: string;
  reasoning?: unknown;
  reasoningText?: string;
  response?: unknown;
  steps?: readonly unknown[];
  text?: string;
  totalUsage?: LanguageModelUsage;
  usage?: LanguageModelUsage;
  toolCalls: unknown;
  toolResults: unknown;
};

export function getAgentLogDetail(): AgentLogDetail {
  return process.env.LLM_AGENT_LOG_DETAIL?.toLowerCase() === "full"
    ? "full"
    : "summary";
}

function getStepName<TOOLS extends ToolSet>(step: StepResult<TOOLS>) {
  const toolNames = step.toolCalls.map((toolCall) => toolCall.toolName);
  if (toolNames.length > 0) {
    return toolNames.join("+");
  }
  if (step.text.length > 0) {
    return "text";
  }
  return `step-${step.stepNumber}`;
}

export function buildAgentStepLogPayload<TOOLS extends ToolSet>(
  step: StepResult<TOOLS>,
  detail = getAgentLogDetail(),
) {
  const summary = {
    stepName: getStepName(step),
    stepNumber: step.stepNumber,
  };

  if (detail === "summary") {
    return summary;
  }

  return {
    ...summary,
    text: step.text,
    reasoning: step.reasoning,
    finishReason: step.finishReason,
    toolCalls: step.toolCalls,
    toolResults: step.toolResults,
  };
}

export function buildAgentFinishLogPayload(
  event: FinishLogSource,
  detail = getAgentLogDetail(),
) {
  const summary = {
    stepCount: event.steps?.length,
    finishReason: event.finishReason,
  };

  if (detail === "summary") {
    return summary;
  }

  return {
    ...summary,
    text: event.text,
    reasoning: event.reasoning,
    toolCalls: event.toolCalls,
    toolResults: event.toolResults,
  };
}

type LLMLogger = ReturnType<typeof logger.child> & {
  step<TOOLS extends ToolSet>(step: StepResult<TOOLS>, message?: string): void;
  finish(event: FinishLogSource, message?: string): void;
};

export function createLLMLogging(
  ...args: Parameters<typeof logger.child>
): LLMLogger {
  const log = logger.child(...args);

  return Object.assign(log, {
    step<TOOLS extends ToolSet>(
      step: StepResult<TOOLS>,
      message = "agent.step.finish",
    ) {
      log.info(buildAgentStepLogPayload(step), message);
    },
    finish(event: FinishLogSource, message = "agent.finish") {
      log.info(buildAgentFinishLogPayload(event), message);
    },
  });
}
