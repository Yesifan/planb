import {
  generateText,
  GenerateTextOnStepFinishCallback,
  GenerateTextResult,
  hasToolCall,
  Output,
  Prompt,
  stepCountIs,
  StepResult,
  streamText,
  StreamTextOnStepFinishCallback,
  StreamTextResult,
  ToolLoopAgentSettings,
  type ToolSet,
} from "ai";

import Tools from "./tool";
import { Agent, PlanbProvider } from "./type";
import { primaryModel, secondaryModel } from "./provider";

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
    methodCallback:
      | GenerateTextOnStepFinishCallback<TOOLS>
      | StreamTextOnStepFinishCallback<TOOLS>
      | undefined,
  ) {
    const constructorCallback = this.settings.onStepFinish;

    if (methodCallback && constructorCallback) {
      return async (stepResult: StepResult<TOOLS>) => {
        await constructorCallback(stepResult);
        await methodCallback(stepResult);
      };
    }

    return methodCallback ?? constructorCallback;
  }

  /**
   * Generates an output from the agent (non-streaming).
   */
  async generate({
    abortSignal,
    timeout,
    onStepFinish,
    ...options
  }: Omit<Parameters<typeof generateText<TOOLS, OUTPUT>>[0], "model">): Promise<
    GenerateTextResult<TOOLS, OUTPUT>
  > {
    return generateText({
      ...(await this.prepareCall(options)),
      abortSignal,
      timeout,
      onStepFinish: this.mergeOnStepFinishCallbacks(
        onStepFinish,
      ) as GenerateTextOnStepFinishCallback<TOOLS>,
    });
  }

  /**
   * Streams an output from the agent (streaming).
   */
  async stream({
    abortSignal,
    timeout,
    experimental_transform,
    onStepFinish,
    ...options
  }: Omit<Parameters<typeof streamText<TOOLS, OUTPUT>>[0], "model">): Promise<
    StreamTextResult<TOOLS, OUTPUT>
  > {
    return streamText({
      ...(await this.prepareCall(options)),
      abortSignal,
      timeout,
      experimental_transform,
      onStepFinish: this.mergeOnStepFinishCallbacks(onStepFinish),
    });
  }
}

export function createAgent(
  agent: string,
  provider: PlanbProvider,
  {
    content,
    frontmatter,
  }: {
    content: string;
    frontmatter: Agent;
  },
) {
  const { model, tools, stopWhen, ...config } = frontmatter;

  const toolset = tools?.reduce<ToolSet>((acc, toolName) => {
    if (toolName in Tools) {
      acc[toolName] = Tools[toolName as keyof typeof Tools];
    } else {
      console.debug(`${toolName} tool not found with ${agent} agent!`);
    }
    return acc;
  }, {});

  const stopWhenFun = stopWhen
    ? [
        stopWhen.hasToolCall && hasToolCall(stopWhen.hasToolCall),
        stepCountIs(stopWhen.maxStep ?? 20),
      ].filter((func) => !!func)
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
    tools: toolset,
    stopWhen: stopWhenFun,
    ...config,
  });
}
