import { ModelMessage, ToolCallPart, ToolResultPart } from "ai";

import {
  History,
  MessageWithToolCall,
  NewMessage,
  Story,
} from "@/lib/db/schema";

import { MyUIMessage } from "./type";

export function toUIMessages(messages: MessageWithToolCall[]): MyUIMessage[] {
  return messages.map((message) => {
    const parts: MyUIMessage["parts"] = [];
    if (message.text.length > 0) {
      parts.push({ type: "text", text: message.text });
    }
    parts.push(
      ...(message?.toolCalls?.map(
        (tool) =>
          ({
            type: `tool-${tool.name}`,
            state: "output-available",
            toolName: tool.name,
            toolCallId: tool.id,
            input: tool.input,
            output: tool.result,
          }) as unknown as MyUIMessage["parts"][number],
      ) ?? []),
    );

    return {
      id: message.id,
      role: message.role,
      parts,
    };
  });
}

export function toModelMessage(
  message: MessageWithToolCall | NewMessage | undefined,
) {
  const messages: ModelMessage[] = [];
  if (message === undefined) {
    return messages;
  }
  if ("toolCalls" in message && message.toolCalls?.length > 0) {
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
    messages.push({
      role: "assistant",
      content: toolCallParts,
    });
    if (toolResultParts.length > 0) {
      messages.push({
        role: "tool",
        content: toolResultParts,
      });
    }
  }
  if (message.text.trim().length > 0) {
    messages.push({
      role: message.role,
      content: message.text,
    });
  }

  return messages;
}

export function toModelMessages(
  messages: Array<MessageWithToolCall | NewMessage>,
) {
  return messages.reduce<ModelMessage[]>((acc, message) => {
    const messages = toModelMessage(message);

    return [...acc, ...messages];
  }, []);
}

export function toHistoryModelMessage(history: History[]): ModelMessage {
  const content =
    history.length === 0
      ? "（暂无历史记录）"
      : history.map((h) => h.content).join("\n\n---\n\n");
  return {
    role: "system",
    content: ["# 故事设定", "## 历史年表", content].join("\n"),
  };
}

export function toStoryModelMessage(story?: Story): ModelMessage {
  return {
    role: "system",
    content: story
      ? [
          "# 故事设定",
          `## 故事类型\n${story.type}`,
          `## 世界观设定\n${story.worldview}`,
          `## 初始设定\n${story.describe}`,
          `## 金手指设定\n${story.system ?? "（未设定）"}`,
        ].join("\n")
      : "故事设定尚未生成！",
  };
}
