"use server";

import { createStreamableValue } from "@ai-sdk/rsc";
import type { UIMessageChunk } from "ai";
import { nanoid } from "nanoid";

import { db } from "@/lib/db";
import { ArchivistAgent } from "@/lib/llm";
import logger from "@/lib/logger";

import { getSessionWithRedirect } from "../auth/server";
import { chat, story } from "../db/schema";
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
  const traceId = nanoid();
  const log = logger.child({ traceId, action: "continueConversation" });

  log.info({ chatId, prompt }, "action.continueConversation.start");
  const messages = await getChatMessages(chatId);
  const modelMessages = toModelMessage(messages);

  const stream = createStreamableValue<UIMessageChunk>();

  (async () => {
    const result = await ArchivistAgent.stream({
      messages: [
        ...modelMessages,
        {
          role: "user",
          content: prompt,
        },
      ],
      experimental_context: { db, chatId: chatId, traceId },
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
    content: stream.value,
  };
}

// RSC 多步骤 https://ai-sdk.dev/docs/ai-sdk-rsc/multistep-interfaces
