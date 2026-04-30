"use server";

import { createStreamableValue } from "@ai-sdk/rsc";
import type { UIMessageChunk } from "ai";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "@/lib/db";
import { ArchivistAgent, OracleAgent } from "@/lib/llm";
import logger from "@/lib/logger";

import { getSessionWithRedirect } from "../auth/server";
import {
  chat,
  message,
  MessageWithToolCall,
  NewMessage,
  story,
  toolCall,
} from "../db/schema";
import { saveMessageWithTool } from "../llm/db";
import { toModelMessage } from "../llm/utils";
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
    const result = await ArchivistAgent.stream({
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
  if (recentQuestion) {
    recentQuestion.result = prompt;
    log.debug("insert createQuestion tool");
  } else {
    messages.push({
      id: userMessageId,
      chatId,
      role: "user" as const,
      text: prompt,
      createdAt: now,
    });
    log.debug("input text prompt");
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

  const agent = isSettingComplete ? OracleAgent : ArchivistAgent;

  log.debug({ messages }, "continueConversation input");

  const modelMessages = toModelMessage(messages);

  const stream = createStreamableValue<UIMessageChunk>();

  (async () => {
    const result = await agent.stream({
      prompt: [
        {
          role: "system",
          content: JSON.stringify(story),
        },
        ...modelMessages,
      ],
      experimental_context: { db, chatId: chatId, traceId },
      async onFinish(event) {
        const assistantMessageId = nanoid();
        await saveMessageWithTool(assistantMessageId, event, {
          db,
          chatId,
          traceId,
        });

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
      },
      onError({ error }) {
        log.error({ error }, "action.continueConversation.error");
      },
    });

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
