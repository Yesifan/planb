import {
  GenerateTextOnStepFinishCallback,
  GenerateTextResult,
  Output,
  Prompt,
  StepResult,
  StreamTextOnStepFinishCallback,
  StreamTextResult,
  ToolLoopAgentSettings,
  ToolSet,
} from "ai";
import { generateText, hasToolCall, stepCountIs, streamText } from "ai";

import logger from "../logger";
import { primaryModel, secondaryModel } from "./provider";
import BaseTools from "./tool";
import { agentTools } from "./tool/agent";
import { Agent, PlanbProvider, ToolContext } from "./type";

export class PlanbAgent<
  CALL_OPTIONS = never,
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  TOOLS extends ToolSet = {},
  OUTPUT extends Output.Output = never,
> {
  readonly version = "agent-v1";

  private readonly settings: ToolLoopAgentSettings<CALL_OPTIONS, TOOLS, OUTPUT>;

  constructor(settings: ToolLoopAgentSettings<CALL_OPTIONS, TOOLS, OUTPUT>) {
    this.settings = settings;
  }

  /**
   * The id of the agent.
   */
  get id(): string | undefined {
    return this.settings.id;
  }

  /**
   * The tools that the agent can use.
   */
  get tools(): TOOLS {
    return this.settings.tools as TOOLS;
  }

  private async prepareCall(options: {
    prompt?: string | Array<import("@ai-sdk/provider-utils").ModelMessage>;
    messages?: Array<import("@ai-sdk/provider-utils").ModelMessage>;
    options?: CALL_OPTIONS;
  }): Promise<
    Omit<
      ToolLoopAgentSettings<CALL_OPTIONS, TOOLS, OUTPUT>,
      "prepareCall" | "instructions" | "onStepFinish"
    > &
      Prompt
  > {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { onStepFinish: _settingsOnStepFinish, ...settingsWithoutCallback } =
      this.settings;
    const baseCallArgs = {
      ...settingsWithoutCallback,
      stopWhen: this.settings.stopWhen ?? stepCountIs(20),
      ...options,
    };

    const preparedCallArgs =
      (await this.settings.prepareCall?.(
        baseCallArgs as Parameters<
          NonNullable<
            ToolLoopAgentSettings<CALL_OPTIONS, TOOLS, OUTPUT>["prepareCall"]
          >
        >[0],
      )) ?? baseCallArgs;

    const { instructions, messages, prompt, ...callArgs } = preparedCallArgs;

    return {
      ...callArgs,

      // restore prompt types
      ...({ system: instructions, messages, prompt } as Prompt),
    };
  }

  private mergeOnStepFinishCallbacks(
    ...callbacks: (
      | GenerateTextOnStepFinishCallback<TOOLS>
      | StreamTextOnStepFinishCallback<TOOLS>
      | undefined
    )[]
  ) {
    const constructorCallback = this.settings.onStepFinish;
    const allCallbacks = [constructorCallback, ...callbacks].filter(
      (cb): cb is NonNullable<typeof cb> => cb !== undefined,
    );

    if (allCallbacks.length === 0) {
      return undefined;
    }

    if (allCallbacks.length === 1) {
      return allCallbacks[0];
    }

    return async (stepResult: StepResult<TOOLS>) => {
      for (const callback of allCallbacks) {
        await callback(stepResult);
      }
    };
  }

  /**
   * Generates an output from the agent (non-streaming).
   */
  async generate({
    abortSignal,
    timeout,
    onStepFinish,
    experimental_context,
    ...options
  }: Omit<Parameters<typeof generateText<TOOLS, OUTPUT>>[0], "model">): Promise<
    GenerateTextResult<TOOLS, OUTPUT>
  > {
    const traceId = (experimental_context as ToolContext | undefined)?.traceId;
    const log = logger.child({ traceId, agent: this.id });

    try {
      const prepareOptions = await this.prepareCall(options);

      log.debug(
        { prompt: prepareOptions.prompt, messages: prepareOptions.messages },
        "Agent Generate Input",
      );

      const result = await generateText({
        ...prepareOptions,
        abortSignal,
        timeout,
        experimental_context,
        onStepFinish: this.mergeOnStepFinishCallbacks(
          onStepFinish,
        ) as GenerateTextOnStepFinishCallback<TOOLS>,
      });

      log.info(
        {
          text: result.text,
          usage: result.totalUsage,
        },
        "Agent Generate End",
      );

      return result;
    } catch (error) {
      log.error({ error }, "agent.generate.error");
      throw error;
    }
  }

  /**
   * Streams an output from the agent (streaming).
   */
  async stream({
    abortSignal,
    timeout,
    experimental_transform,
    experimental_context,
    onError,
    onStepFinish,
    ...options
  }: Omit<Parameters<typeof streamText<TOOLS, OUTPUT>>[0], "model">): Promise<
    StreamTextResult<TOOLS, OUTPUT>
  > {
    const traceId = (experimental_context as ToolContext | undefined)?.traceId;
    const log = logger.child({ traceId, agent: this.id });

    const prepareOptions = await this.prepareCall(options);

    log.debug(
      { prompt: prepareOptions.prompt, messages: prepareOptions.messages },
      "Agent Stream Input",
    );

    return streamText({
      ...prepareOptions,
      abortSignal,
      timeout,
      experimental_transform,
      experimental_context,
      onError: (e) => {
        log.error(e, "Agent Stream Error");
        onError?.(e);
      },
      onStepFinish: this.mergeOnStepFinishCallbacks(onStepFinish),
    });
  }
}

type AgentSetting = {
  content: string;
  frontmatter: Agent;
};
export function createAgent<TOOLS extends ToolSet>(
  agent: string,
  provider: PlanbProvider,
  { content, frontmatter }: AgentSetting,
  options: Partial<
    Omit<ToolLoopAgentSettings<unknown, TOOLS, never>, "model">
  > = {},
) {
  const { model, tools, toolChoice, stopWhen, ...config } = frontmatter;

  const allTools = { ...BaseTools, ...agentTools };

  const toolset = tools?.reduce<ToolSet>((acc, toolName) => {
    if (toolName in allTools) {
      acc[toolName] = allTools[toolName as keyof typeof allTools];
    } else {
      logger.warn({ tool: toolName, agent }, "agent.tool.not_found");
    }
    return acc;
  }, {});

  const toolChoiceConfig =
    toolChoice && toolset
      ? ["required", "auto", "none"].includes(toolChoice)
        ? (toolChoice as "required" | "auto" | "none")
        : Object.keys(toolset).find((key) => key === toolChoice)
          ? (toolChoice as never)
          : undefined
      : undefined;

  logger.debug(
    toolset ? { agent, tools: Object.keys(toolset) } : { agent, tools: [] },
    "agent.tools.loaded",
  );

  const hasToolCallFun = stopWhen?.hasToolCall
    ? stopWhen.hasToolCall.map((toolName) => hasToolCall(toolName))
    : [];

  const stopWhenFun = stopWhen
    ? [...hasToolCallFun, stepCountIs(stopWhen.maxStep ?? 20)].filter(
        (func) => !!func,
      )
    : stepCountIs(20);

  const modelId =
    model === "primary"
      ? primaryModel
      : model === "secondary"
        ? secondaryModel
        : model;

  return new PlanbAgent({
    model: provider(modelId ?? primaryModel),
    instructions: content,
    tools: toolset as TOOLS,
    toolChoice: toolChoiceConfig,
    stopWhen: stopWhenFun,
    ...config,
    ...options,
  });
}
