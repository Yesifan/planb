import { OnFinishEvent, ToolSet } from "ai";

import { message, toolCall as toolCallDB } from "@/lib/db/schema";
import logger from "@/lib/logger";

import { db } from "../db";
import { ToolContext } from "./type";
import { addUsage } from "./usage";

export const saveMessageWithTool = async <T extends ToolSet>(
  messageId: string,
  {
    text,
    reasoning,
    model,
    toolCalls,
    toolResults,
    totalUsage,
  }: OnFinishEvent<T>,
  experimental_context: ToolContext,
) => {
  const { chatId, traceId } = experimental_context;

  const log = logger.child({ traceId, action: "saveMessageWithTool" });

  if (!chatId) {
    log.error(
      experimental_context,
      "chat id not found with experimental_context",
    );
    throw new Error("chat id not found with experimental_context");
  }

  const now = new Date();

  const reasoningText = reasoning.reduce(
    (acc, reason) => acc + reason.text,
    "",
  );

  log.debug({ text, reasoningText, toolCalls }, "save in DB");

  if (experimental_context.tokenUsage) {
    addUsage(experimental_context.tokenUsage, totalUsage);
  }

  db.transaction((tx) => {
    tx.insert(message).values({
      id: messageId,
      chatId: chatId,
      role: "assistant",
      text: text,
      reasoning: reasoningText,
      inputTokens: experimental_context.tokenUsage?.inputTokens ?? totalUsage?.inputTokens,
      outputTokens: experimental_context.tokenUsage?.outputTokens ?? totalUsage?.outputTokens,
      model: typeof model === "string" ? model : model?.modelId,
      createdAt: now,
    }).run();

    if (toolCalls.length > 0) {
      tx.insert(toolCallDB).values(
        toolCalls
          .filter((toolCall) => !toolCall.dynamic)
          .map((toolCall) => {
            const result = toolResults.find(
              (result) => result.toolCallId === toolCall.toolCallId,
            )?.output;
            return {
              id: toolCall.toolCallId,
              messageId: messageId,
              name: toolCall.toolName as (typeof import("./tool").AllToolKeys)[number],
              input: toolCall.input as Record<string, unknown>,
              result: result ? JSON.stringify(result) : undefined,
              createdAt: now,
            };
          }),
      ).run();
    }
  });
};
