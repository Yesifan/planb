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
import { arbiter, archivist, oracle, sentinel, weaver } from "@/lib/llm";
import { saveMessageWithTool } from "@/lib/llm/db";
import {
  toHistoryModelMessage,
  toModelMessages,
  toStoryModelMessage,
} from "@/lib/llm/utils";
import logger from "@/lib/logger";

import { ToolContext } from "../llm/type";
import { getChatHistory, getLastestChatMessage } from "./db";

export async function createStory(source: string, singularity: string) {
  const traceId = nanoid();
  const log = logger.child({ traceId, action: "createStory" });

  log.info({ source, singularity }, "action.createStory.start");

  const session = await getSessionWithRedirect();

  const prompt = `source: ${source}\n singularity: ${singularity}`;

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

  const stream = createStreamableValue<UIMessageChunk>();
  (async () => {
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
) {
  const traceId = nanoid();
  const log = logger.child({ traceId, action: "continueCreateStory" });

  const archivistResult = await archivist.generate({
    prompt: messages,
    experimental_context,
  });

  log.debug(
    {
      text: archivistResult.text,
      messages: archivistResult.response.messages,
    },
    "archivist output",
  );

  return await weaver.stream({
    prompt: [
      ...archivistResult.response.messages,
      {
        role: "system",
        content:
          "根据故事世界观和背景生成故事开端。 必须详细描写特异点的前因以及特异点是如何发生的。在描述的结尾自然的留一个扣子，让用户和这个世界进行交互！",
      },
    ],
    experimental_context,
    onFinish,
  });
}

/**
 * 主流程：Sentinel → Oracle → Arbiter(审查选优) → Weaver
 *
 * 1. Sentinel 审查用户输入 — 不合理则 rejectInput，合理则转化为历史年表
 * 2. Oracle 根据审查后的输入生成分支剧情（内部通过 dice/activateSystem tools 调度骰子和系统）
 * 3. Arbiter 审查 Oracle 分支 — 逻辑不通则打回（暂不实现循环），通过则打分选优输出历史年表
 * 4. Weaver 将审核通过的历史年表扩写为小说正文
 */
async function continueStory(
  chatId: string,
  messages: ModelMessage[],
  experimental_context: ToolContext,
  onFinish: (event: OnFinishEvent<ToolSet>) => Promise<void>,
) {
  const log = logger.child({
    traceId: experimental_context.traceId,
    action: "continueStory",
  });

  // Step 1: Sentinel 审查用户输入
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

    return sentinelInputResult;
  }

  // Step 2: Oracle 根据审查后的输入生成分支
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

  for (const step of oracleResult.steps) {
    log.debug(
      {
        toolCalls: step.toolCalls.map((tc) => ({
          name: tc.toolName,
        })),
      },
      "Oracle Step Chain",
    );
  }

  log.debug({ text: oracleResult.text }, "Oracle Branches");

  // Step 3: Arbiter 审查 Oracle 分支
  const arbiterBranchResult = await arbiter.stream({
    prompt: [
      ...oraclePrompt.slice(0, -1),
      {
        role: "user",
        content: `请审查以下 Oracle 生成的剧情分支: \n\n${oracleResult.text}`,
      },
    ],
    experimental_context,
  });

  const arbiterText = await arbiterBranchResult.text;

  log.debug({ arbiterText }, "Arbiter Review");

  // Step 4: Weaver 将审核通过的历史年表扩写为小说正文
  return await weaver.stream({
    prompt: [
      ...oraclePrompt.slice(0, -1),
      {
        role: "user",
        content: `以下是剧情大纲：\n\n${arbiterText}\n\n`,
      },
    ],
    experimental_context,
    onAbort(event) {
      log.info(event, "weaver abort");
    },
    async onFinish(options) {
      log.debug({ arbiterText, weaverText: options.text }, "weaver finish");

      const now = new Date();
      await db.insert(history).values({
        id: nanoid(),
        chatId: chatId,
        content: arbiterText,
        createdAt: now,
      });
      await onFinish(options as unknown as OnFinishEvent<ToolSet>);
      log.debug("weaver save db finish");
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
  const latestMessage: MessageWithToolCall | NewMessage | undefined =
    await getLastestChatMessage(chatId);

  const recentQuestion =
    latestMessage &&
    "toolCalls" in latestMessage &&
    latestMessage.toolCalls?.find(
      (tc) => tc.name === "createQuestion" && !tc.result,
    );

  const recnetMessages: Array<MessageWithToolCall | NewMessage> = latestMessage
    ? [latestMessage]
    : [];
  if (recentQuestion) {
    recentQuestion.result = prompt;
  } else {
    recnetMessages.push({
      id: userMessageId,
      chatId,
      role: "user" as const,
      text: prompt,
      createdAt: now,
    });
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
  const inputMessages = toModelMessages(recnetMessages);
  const modelMessage = [storyMessage, hsitoryMessage, ...inputMessages];

  log.debug({ chatId, prompt, latestMessage, modelMessage }, "input");

  const stream = createStreamableValue<UIMessageChunk>();

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
        )
      : await continueCreateStory(
          chatId,
          modelMessage,
          experimental_context,
          onFinish,
        );

    log.debug("stream ui message start");

    const uiMessages = result.toUIMessageStream();

    for await (const chunk of uiMessages) {
      stream.update(chunk);
    }

    stream.done();
    log.debug("stream ui message done");
  })();

  return {
    id: chatId,
    messageId: userMessageId,
    content: stream.value,
  };
}
