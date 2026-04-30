import {
  AssistantContent,
  ModelMessage,
  ToolCallPart,
  ToolResultPart,
} from "ai";

import { MessageWithToolCall, NewMessage } from "@/lib/db/schema";

import { MyUIMessage } from "./type";

export function toUIMessages(messages: MessageWithToolCall[]): MyUIMessage[] {
  return messages.map((message) => {
    const parts: MyUIMessage["parts"] =
      message?.toolCalls?.map(
        (tool) =>
          ({
            type: `tool-${tool.name}`,
            state: "output-available",
            toolName: tool.name,
            toolCallId: tool.id,
            input: tool.input,
            output: tool.result,
          }) as MyUIMessage["parts"][number],
      ) ?? [];

    if (message.text.length > 0) {
      parts.push({ type: "text", text: message.text });
    }

    return {
      id: message.id,
      role: message.role,
      parts,
    };
  });
}

export function toModelMessage(
  messages: Array<MessageWithToolCall | NewMessage>,
) {
  return messages.reduce<ModelMessage[]>((acc, message) => {
    if ("toolCalls" in message) {
      const toolCallParts: ToolCallPart[] = [];
      const toolResultParts: ToolResultPart[] = [];
      message.toolCalls?.forEach((toolCall) => {
        toolCallParts.push({
          type: "tool-call",
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          input: toolCall.input,
        });

        if (toolCall.result) {
          toolResultParts.push({
            type: "tool-result",
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            output: {
              type: "text",
              value: toolCall.result,
            },
          });
        }
      });
      acc.push({
        role: "assistant",
        content: toolCallParts,
      });
      if (toolResultParts.length > 0) {
        acc.push({
          role: "tool",
          content: toolResultParts,
        });
      }
    } else {
      acc.push({
        role: message.role,
        content: message.text,
      });
    }

    return acc;
  }, []);
}
