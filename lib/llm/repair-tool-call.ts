import type { LanguageModelV3ToolCall } from "@ai-sdk/provider";
import {
  generateText,
  jsonSchema,
  Output,
  type ToolSet,
} from "ai";

/**
 * Create a tool call repair function that uses the same model to fix
 * invalid JSON tool call parameters in-place, without re-running the
 * entire agent.
 *
 * When a model generates a tool call with parameters that fail schema
 * validation (e.g. malformed JSON), the AI SDK invokes this function
 * to attempt a repair. The repair calls `generateText` with the tool's
 * parameter schema as structured output, producing valid parameters.
 *
 * If the tool is unknown or repair fails, returns `null` to let the
 * error propagate through normal AI SDK error handling.
 */
export function createRepairToolCall(model: Parameters<typeof generateText>[0]["model"]) {
  return async function repairToolCall<TOOLS extends ToolSet>({
    toolCall,
    tools,
    inputSchema,
    error,
  }: {
    system: string | unknown;
    messages: unknown[];
    toolCall: LanguageModelV3ToolCall;
    tools: TOOLS;
    inputSchema: (options: { toolName: string }) => PromiseLike<unknown>;
    error: unknown;
  }): Promise<LanguageModelV3ToolCall | null> {
    const tool = tools[toolCall.toolName as keyof typeof tools];
    if (!tool) return null;

    try {
      const schema = await inputSchema({ toolName: toolCall.toolName });
      const repairResult = await generateText({
        model,
        output: Output.object({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          schema: jsonSchema(schema as any),
        }),
        prompt: [
          "修复以下工具调用参数。",
          "",
          `工具名称：${toolCall.toolName}`,
          "",
          `原始参数：${toolCall.input}`,
          "",
          `校验错误：${error instanceof Error ? error.message : String(error)}`,
          "",
          "要求：",
          "- 只修复参数",
          "- 不要改变用户意图",
          "- 不要补充无法从上下文推断的信息",
          "- 输出必须符合给定 Schema",
        ].join("\n"),
      });

      return {
        ...toolCall,
        input: JSON.stringify(repairResult.output),
      };
    } catch {
      return null;
    }
  };
}