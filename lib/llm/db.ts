import { OnFinishEvent } from "ai";

import { message, toolCall as toolCallDB } from "@/lib/db/schema";
import logger from "@/lib/logger";

import Tools from "./tool";
import { ToolContext } from "./type";

export const saveMessageWithTool = async (
  messageId: string,
  {
    text,
    reasoning,
    model,
    toolCalls,
    toolResults,
    totalUsage,
  }: OnFinishEvent<typeof Tools>,
  experimental_context: ToolContext,
) => {
  const { db, chatId, traceId } = experimental_context;

  if (!db || !chatId) {
    const log = logger.child({ traceId, action: "createStory" });
    log.error(
      experimental_context,
      "db or chat id not found with experimental_context",
    );
    throw new Error("db or chat id not found with experimental_context");
  }

  const now = new Date();

  const reasoningText = reasoning.reduce(
    (acc, reason) => acc + reason.text,
    "",
  );

  db.transaction((tx) => {
    tx.insert(message)
      .values({
        id: messageId,
        chatId: chatId,
        role: "assistant",
        text: text,
        reasoning: reasoningText,
        inputTokens: totalUsage?.inputTokens,
        outputTokens: totalUsage?.outputTokens,
        model: typeof model === "string" ? model : model?.modelId,
        createdAt: now,
      })
      .run();

    if (toolCalls.length > 0) {
      tx.insert(toolCallDB)
        .values(
          toolCalls
            .filter((toolCall) => !toolCall.dynamic)
            .map((toolCall) => {
              const result = toolResults.find(
                (result) => result.toolCallId === toolCall.toolCallId,
              )?.output;
              return {
                id: toolCall.toolCallId,
                messageId: messageId,
                name: toolCall.toolName,
                input: toolCall.input,
                result: result ? JSON.stringify(result) : undefined,
                createdAt: now,
              };
            }),
        )
        .run();
    }
  });
};
