"use client";

import { readStreamableValue, StreamableValue } from "@ai-sdk/rsc";
import {
  AssistantContent,
  isToolUIPart,
  ModelMessage,
  parsePartialJson,
  TextUIPart,
  ToolCallPart,
  ToolResultPart,
  UIMessageChunk,
} from "ai";

import { MessageWithToolCall } from "@/lib/db/schema";

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

export function toModelMessage(messages: MessageWithToolCall[]) {
  return messages.map((message) => {
    const toolResults =
      message.toolCalls?.reduce<Exclude<AssistantContent, string>>(
        (toolResults, toolCall) => {
          const toolMessage = toolCall.result
            ? ({
                type: "tool-result",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                output: {
                  type: "text",
                  value: toolCall.result,
                },
              } as ToolResultPart)
            : ({
                type: "tool-call",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                input: toolCall.input,
              } as ToolCallPart);

          return [...toolResults, toolMessage];
        },
        [],
      ) ?? [];

    return {
      role: message.role,
      content: [...toolResults, message.text],
    } as ModelMessage;
  });
}

type PartialToolCall = {
  text: string;
  toolName: string;
  dynamic?: boolean;
  title?: string;
};

function findToolPart(
  parts: MyUIMessage["parts"],
  toolCallId: string,
): MyUIMessage["parts"][number] | undefined {
  return parts.find((p) => isToolUIPart(p) && p.toolCallId === toolCallId);
}

export async function* streamToUIMessage(
  id: string,
  stream: StreamableValue<UIMessageChunk>,
): AsyncGenerator<MyUIMessage, MyUIMessage> {
  const message: MyUIMessage = {
    id: id ?? "",
    role: "assistant",
    parts: [],
  };

  const activeTextParts: Record<string, TextUIPart> = {};
  const partialToolCalls: Record<string, PartialToolCall> = {};

  for await (const chunk of readStreamableValue(stream)) {
    if (!chunk) continue;

    switch (chunk.type) {
      case "text-start": {
        const textPart: TextUIPart = {
          type: "text",
          text: "",
          state: "streaming",
        };
        activeTextParts[chunk.id] = textPart;
        message.parts.push(textPart);
        break;
      }

      case "text-delta": {
        const textPart = activeTextParts[chunk.id];
        if (textPart) {
          textPart.text += chunk.delta;
        }
        break;
      }

      case "text-end": {
        const textPart = activeTextParts[chunk.id];
        if (textPart) {
          textPart.state = "done";
          delete activeTextParts[chunk.id];
        }
        break;
      }

      case "tool-input-start": {
        partialToolCalls[chunk.toolCallId] = {
          text: "",
          toolName: chunk.toolName,
          dynamic: chunk.dynamic,
          title: chunk.title,
        };
        message.parts.push({
          type: chunk.dynamic ? "dynamic-tool" : `tool-${chunk.toolName}`,
          toolName: chunk.toolName,
          toolCallId: chunk.toolCallId,
          state: "input-streaming",
          title: chunk.title,
        } as MyUIMessage["parts"][number]);
        break;
      }

      case "tool-input-delta": {
        const partial = partialToolCalls[chunk.toolCallId];
        if (partial) {
          partial.text += chunk.inputTextDelta;
          const part = findToolPart(message.parts, chunk.toolCallId);
          if (part && isToolUIPart(part)) {
            const { value } = await parsePartialJson(partial.text);

            (part as Record<string, unknown>).input = value;
          }
        }
        break;
      }

      case "tool-input-available": {
        const part = findToolPart(message.parts, chunk.toolCallId);
        if (part && isToolUIPart(part)) {
          (part as Record<string, unknown>).state = "input-available";

          (part as Record<string, unknown>).input = chunk.input;
        }
        break;
      }

      case "tool-output-available": {
        const part = findToolPart(message.parts, chunk.toolCallId);
        if (part && isToolUIPart(part)) {
          (part as Record<string, unknown>).state = "output-available";

          (part as Record<string, unknown>).output = chunk.output;
        }
        break;
      }

      case "tool-output-error": {
        const part = findToolPart(message.parts, chunk.toolCallId);
        if (part && isToolUIPart(part)) {
          (part as Record<string, unknown>).state = "output-error";

          (part as Record<string, unknown>).errorText = chunk.errorText;
        }
        break;
      }

      case "start": {
        if (chunk.messageId) {
          message.id = chunk.messageId;
        }
        break;
      }

      case "start-step": {
        break;
      }

      case "finish-step": {
        break;
      }
    }

    yield structuredClone(message);
  }

  return message;
}
