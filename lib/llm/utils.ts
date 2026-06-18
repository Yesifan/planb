import { ModelMessage, ToolCallPart, ToolResultPart } from "ai";

import {
  History,
  MessageWithToolCall,
  NewMessage,
  ProtagonistState,
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

  if (message.text.trim().length > 0) {
    messages.push({
      role: message.role,
      content: message.text,
    });
  }
  if (
    message.role === "assistant" &&
    "toolCalls" in message &&
    message.toolCalls?.length > 0
  ) {
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

export function toHistoryModelMessage(
  history: History[],
): ModelMessage | undefined {
  if (history.length === 0) {
    return undefined;
  }
  return {
    role: "user",
    content: [
      "# 故事历史",
      history.map((h) => h.content).join("\n\n---\n\n"),
    ].join("\n"),
  };
}

export function toRuntimeStateModelMessage({
  protagonistState,
  story,
}: {
  protagonistState?: ProtagonistState;
  story?: Story;
}): ModelMessage | undefined {
  const sections = [
    protagonistState
      ? [
          "## 主角状态",
          `### 主角摘要\n${protagonistState.profile}`,
          protagonistState.resources
            ? `### 可用资源\n${protagonistState.resources}`
            : undefined,
          "### 主角五维",
          protagonistState.dimensions
            .map(
              (dimension) =>
                `- ${dimension.name}: ${dimension.value}/100，${dimension.summary}`,
            )
            .join("\n"),
        ]
            .filter((section) => section !== undefined)
            .join("\n")
      : undefined,
    story?.worldSnapshot
      ? ["## 世界当前快照", story.worldSnapshot].join("\n")
      : undefined,
    story?.taskState ? ["## 任务系统", story.taskState].join("\n") : undefined,
  ].filter((section) => section !== undefined);

  if (sections.length === 0) {
    return undefined;
  }

  return {
    role: "user",
    content: ["# 运行状态", ...sections].join("\n\n"),
  };
}

export function toStoryModelMessage(story?: Story): ModelMessage | undefined {
  if (!story || !story.type) {
    return undefined;
  }
  return {
    role: "user",
    content: [
      "# 故事设定",
      `## 故事类型\n${story.type}`,
      `## 世界观设定\n${story.worldview}`,
      `## 金手指设定\n${story.system ?? "无设定"}`,
    ].join("\n"),
  };
}
