"use server";

import { createStreamableValue } from "@ai-sdk/rsc";
import type { ModelMessage, OnFinishEvent, ToolSet, UIMessageChunk } from "ai";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import { getSessionWithRedirect } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
  chat,
  history,
  message,
  MessageWithToolCall,
  NewMessage,
  story,
  toolCall,
} from "@/lib/db/schema";
import { archivist, oracle, sentinel, weaver } from "@/lib/llm";
import { saveMessageWithTool } from "@/lib/llm/db";
import {
  toHistoryModelMessage,
  toModelMessage,
  toStoryModelMessage,
} from "@/lib/llm/utils";
import logger from "@/lib/logger";

import { AgentStatusEvent, ToolContext } from "../llm/type";
import { getChatHistory, getLastestChatMessage } from "./db";

interface StreamUpdater {
  update(value: UIMessageChunk | AgentStatusEvent): void;
  done(): void;
}

const AGENT_STATUS_TEXT = {
  Sentinel: "正在审查输入...",
  Oracle: "正在生成大纲...",
  Weaver: "正在撰写故事...",
  Archivist: "正在构建世界观...",
} as const;

export async function createStory(source: string, singularity: string) {
  const traceId = nanoid();
  const log = logger.child({ traceId, action: "createStory" });

  log.info({ source, singularity }, "start");

  const session = await getSessionWithRedirect();

  const prompt = `# 故事设定\n\n## 故事来源\n${source}\n\n## 特异点\n${singularity}`;

  const chatId = nanoid();
  const storyId = nanoid();
  const messageId = nanoid();
  const now = new Date();

  await db.insert(chat).values({
    id: chatId,
    userId: session.user.id,
    title: source,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(story).values({
    id: storyId,
    chatId,
    source,
    singularity,
    createdAt: now,
    updatedAt: now,
  });

  const stream = createStreamableValue<UIMessageChunk | AgentStatusEvent>();
  (async () => {
    stream.update({ type: "agent-status", agentId: "Archivist", statusText: AGENT_STATUS_TEXT.Archivist });
    const result = await archivist.stream({
      prompt,
      experimental_context: { db, chatId, traceId },
      onFinish(event) {
        saveMessageWithTool(
          messageId,
          event as unknown as OnFinishEvent<ToolSet>,
          { db, chatId, traceId },
        );
      },
      onError({ error }) {
        log.error({ error }, "action.createStory.error");
      },
    });

    const uiMessages = result.toUIMessageStream();

    for await (const chunk of uiMessages) {
      stream.update(chunk);
    }

    stream.update({ type: "agent-status", agentId: null });
    stream.done();
  })();

  return {
    id: chatId,
    messageId: messageId,
    content: stream.value,
  };
}

async function continueCreateStory(
  chatId: string,
  messages: ModelMessage[],
  experimental_context: ToolContext,
  onFinish: (event: OnFinishEvent<ToolSet>) => Promise<void>,
  stream: StreamUpdater,
) {
  stream.update({ type: "agent-status", agentId: "Archivist", statusText: AGENT_STATUS_TEXT.Archivist });
  const archivistResult = await archivist.generate({
    prompt: messages,
    experimental_context,
  });

  stream.update({ type: "agent-status", agentId: "Weaver", statusText: AGENT_STATUS_TEXT.Weaver });
  return await weaver.stream({
    prompt: [
      ...archivistResult.response.messages,
      {
        role: "system",
        content:
          "根据故事世界观和背景生成故事开端。必须详细描写特异点的前因以及特异点是如何发生的。在描述的结尾自然的留一个扣子，让用户和这个世界进行交互！",
      },
    ],
    experimental_context,
    onFinish,
  });
}

/**
 * 主流程：Sentinel → Oracle(内部含 Arbiter 审查循环) → Weaver
 *
 * 1. Sentinel 审查用户输入 — 不合理则 rejectInput，合理则转化为历史年表
 * 2. Oracle 根据审查后的输入生成分支剧情（内部通过 reviewBranch/dice/activateSystem 工具完成审查和调度）
 * 3. Weaver 将审核通过的历史年表扩写为小说正文
 */
async function continueStory(
  chatId: string,
  messages: ModelMessage[],
  experimental_context: ToolContext,
  onFinish: (event: OnFinishEvent<ToolSet>) => Promise<void>,
  stream: StreamUpdater,
) {
  const log = logger.child({
    traceId: experimental_context.traceId,
    action: "continueStory",
  });

  // Step 1: Sentinel 审查用户输入
  stream.update({ type: "agent-status", agentId: "Sentinel", statusText: AGENT_STATUS_TEXT.Sentinel });
  const sentinelInputResult = await sentinel.stream({
    prompt: messages,
    experimental_context,
    async onFinish(event) {
      const wasRejected = event.toolCalls.some(
        (tc) => tc.toolName === "rejectInput",
      );
      if (wasRejected) {
        await onFinish(event as unknown as OnFinishEvent<ToolSet>);
      }
    },
  });

  // 检查是否被 rejectInput tool 拒绝
  const rejected = (await sentinelInputResult.steps).some((step) =>
    step.toolCalls.some((tc) => tc.toolName === "rejectInput"),
  );

  if (rejected) {
    log.debug("Sentinel Review Rejected");
    stream.update({ type: "agent-status", agentId: null });
    return sentinelInputResult;
  }

  // Step 2: Oracle 根据审查后的输入生成分支
  stream.update({ type: "agent-status", agentId: "Oracle", statusText: AGENT_STATUS_TEXT.Oracle });
  const oraclePrompt = [
    ...messages.slice(0, -1),
    {
      role: "user",
      content: await sentinelInputResult.text,
    } as ModelMessage,
  ];

  const oracleResult = await oracle.generate({
    prompt: oraclePrompt,
    experimental_context,
  });

  const latestMessage = await db.query.message.findFirst({
    where: {
      chatId: chatId,
      role: "assistant",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  stream.update({ type: "agent-status", agentId: "Weaver", statusText: AGENT_STATUS_TEXT.Weaver });
  return await weaver.stream({
    prompt: [
      messages[0],
      {
        role: "system",
        content: latestMessage
          ? "以下是上一章节的内容：\n\n" + latestMessage.text
          : "",
      },
      {
        role: "system",
        content: `以下是剧情大纲：\n\n${oracleResult.text}`,
      },
      {
        role: "user",
        content:
          "根据剧情大纲完成小说内容。要求与上一章节风格一致，剧情衔接得当。",
      },
    ],
    experimental_context,
    onAbort(event) {
      log.info(event, "weaver abort");
    },
    async onFinish(options) {
      const now = new Date();
      await db.insert(history).values({
        id: nanoid(),
        chatId: chatId,
        content: oracleResult.text,
        createdAt: now,
      });
      await onFinish(options as unknown as OnFinishEvent<ToolSet>);
    },
  });
}

export async function continueConversation(chatId: string, prompt: string) {
  if (prompt.trim().length === 0) {
    throw new Error("input is empty!");
  }
  const traceId = nanoid();
  const log = logger.child({ traceId, action: "continueConversation" });
  const userMessageId = nanoid();

  const now = new Date();

  log.info({ chatId, prompt }, "Input");

  const history = await getChatHistory(chatId);
  const storyData = await db.query.story.findFirst({
    where: { chatId: chatId },
  });
  const latestMessage = await getLastestChatMessage(chatId);

  const recentQuestion =
    latestMessage &&
    "toolCalls" in latestMessage &&
    latestMessage.toolCalls?.find(
      (tc) => tc.name === "createQuestion" && !tc.result,
    );

  let recnetMessages: MessageWithToolCall | NewMessage | undefined =
    latestMessage;
  if (recentQuestion) {
    recentQuestion.result = prompt;
  } else {
    recnetMessages = {
      id: userMessageId,
      chatId,
      role: "user" as const,
      text: prompt,
      createdAt: now,
    };
  }

  if (recentQuestion) {
    await db
      .update(toolCall)
      .set({ result: prompt })
      .where(eq(toolCall.id, recentQuestion.id));
  } else {
    await db.insert(message).values({
      id: userMessageId,
      chatId,
      role: "user" as const,
      text: prompt,
      createdAt: now,
    });
  }

  const isSettingComplete =
    storyData?.type && storyData?.describe && storyData?.worldview;

  const storyMessage = toStoryModelMessage(storyData);
  const hsitoryMessage = toHistoryModelMessage(history);
  const inputMessages = toModelMessage(recnetMessages);
  const modelMessage = [storyMessage, hsitoryMessage, ...inputMessages];

  const stream = createStreamableValue<UIMessageChunk | AgentStatusEvent>();

  (async () => {
    const experimental_context = { db: db, chatId: chatId, traceId: traceId };
    const onFinish = async (
      event: Parameters<typeof saveMessageWithTool>[1],
    ) => {
      const assistantMessageId = nanoid();
      await saveMessageWithTool(assistantMessageId, event, {
        db,
        chatId,
        traceId,
      });
    };

    const result = isSettingComplete
      ? await continueStory(
          chatId,
          modelMessage,
          experimental_context,
          onFinish,
          stream,
        )
      : await continueCreateStory(
          chatId,
          modelMessage,
          experimental_context,
          onFinish,
          stream,
        );

    log.debug("stream ui message start");

    const uiMessages = result.toUIMessageStream();

    for await (const chunk of uiMessages) {
      stream.update(chunk);
    }

    stream.update({ type: "agent-status", agentId: null });
    stream.done();
    log.debug("stream ui message done");
  })();

  return {
    id: chatId,
    messageId: userMessageId,
    content: stream.value,
  };
}
