"use server";

import { createStreamableValue } from "@ai-sdk/rsc";
import type {
  GenerateTextOnFinishCallback,
  ModelMessage,
  StreamTextResult,
  UIMessageChunk,
} from "ai";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import { getSessionWithRedirect } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
  chat,
  message,
  MessageWithToolCall,
  NewMessage,
  story,
  toolCall,
} from "@/lib/db/schema";
import { archivist, oracle, weaver } from "@/lib/llm";
import { saveMessageWithTool } from "@/lib/llm/db";
import Tools from "@/lib/llm/tool";
import { toModelMessage } from "@/lib/llm/utils";
import logger from "@/lib/logger";

import { ToolContext } from "../llm/type";
import { getChatMessages } from "./db";

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

  // First insert into chat table
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
        saveMessageWithTool(messageId, event, { db, chatId, traceId });
      },
      onError({ error }) {
        log.error({ error }, "action.continueConversation.error");
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
  onFinish: GenerateTextOnFinishCallback<typeof Tools>,
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
      steps: archivistResult.steps,
      messages: archivistResult.response.messages,
    },
    "archivist output",
  );

  const result = await weaver.stream({
    prompt: [
      ...archivistResult.response.messages,
      {
        role: "user",
        content: "请根据故事背景，叙述故事的开端",
      },
    ],
    experimental_context,
    onFinish(options) {
      onFinish(options);
    },
  });

  return result;
}

async function continueStory(
  chatId: string,
  messages: ModelMessage[],
  experimental_context: ToolContext,
  onFinish: GenerateTextOnFinishCallback<typeof Tools>,
) {
  const log = logger.child({
    traceId: experimental_context.traceId,
    action: "continueCreateStory",
  });

  const result = await oracle.stream({
    prompt: messages,
    experimental_context,
    onFinish(options) {
      onFinish(options);
      log.debug({ text: options.text }, "output");
    },
  });

  return result;
}

// API 参考 https://ai-sdk.dev/cookbook/rsc/stream-text#stream-text
export async function continueConversation(chatId: string, prompt: string) {
  if (prompt.trim().length === 0) {
    throw new Error("input is empty!");
  }
  const traceId = nanoid();
  const log = logger.child({ traceId, action: "continueConversation" });
  const userMessageId = nanoid();

  const now = new Date();

  log.info({ chatId, prompt }, "action.continueConversation.start");

  // Insert user message first

  const messages: Array<MessageWithToolCall | NewMessage> =
    await getChatMessages(chatId);
  const messagesLen = messages.length - 1;
  const recentQuestion =
    "toolCalls" in messages[messagesLen] &&
    messages[messagesLen].toolCalls?.find(
      (tc) => tc.name === "createQuestion" && !tc.result,
    );

  // 根据最后一条信息的类型，把 prompt 合并到正确的消息类型里
  if (recentQuestion) {
    recentQuestion.result = prompt;
  } else {
    messages.push({
      id: userMessageId,
      chatId,
      role: "user" as const,
      text: prompt,
      createdAt: now,
    });
  }
  // save input
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

  const story = await db.query.story.findFirst({
    where: { chatId: chatId },
    columns: {
      source: true,
      singularity: true,
      type: true,
      describe: true,
      worldview: true,
    },
  });

  const isSettingComplete = story?.type && story?.describe && story?.worldview;

  log.debug({ chatId, prompt, messages }, " input");

  const modelMessages = toModelMessage(messages);

  const stream = createStreamableValue<UIMessageChunk>();

  (async () => {
    const experimental_context = { db: db, chatId: chatId, traceId: traceId };
    const onFinish: GenerateTextOnFinishCallback<typeof Tools> = async (
      event,
    ) => {
      // save result
      const assistantMessageId = nanoid();
      await saveMessageWithTool(assistantMessageId, event, {
        db,
        chatId,
        traceId,
      });
    };

    let result: StreamTextResult<typeof Tools, never> | undefined = undefined;
    if (isSettingComplete) {
      result = await continueStory(
        chatId,
        modelMessages,
        experimental_context,
        onFinish,
      );
    } else {
      result = await continueCreateStory(
        chatId,
        modelMessages,
        experimental_context,
        onFinish,
      );
    }

    const uiMessages = result.toUIMessageStream();

    for await (const chunk of uiMessages) {
      stream.update(chunk);
      // logger.debug(chunk, "continueConversation chunk");
    }

    stream.done();
  })();

  return {
    id: chatId,
    messageId: userMessageId,
    content: stream.value,
  };
}

// RSC 多步骤 https://ai-sdk.dev/docs/ai-sdk-rsc/multistep-interfaces
