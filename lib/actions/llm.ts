"use server";

import { createStreamableValue } from "@ai-sdk/rsc";
import type { UIMessageChunk } from "ai";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "@/lib/db";
import { ArchivistAgent, OracleAgent } from "@/lib/llm";
import logger from "@/lib/logger";

import { getSessionWithRedirect } from "../auth/server";
import { chat, message, story, toolCall } from "../db/schema";
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
  const userMessageId = nanoid();
  const assistantMessageId = nanoid();
  const now = new Date();

  log.info({ chatId, prompt }, "action.continueConversation.start");

  // Insert user message first
  await db.insert(message).values({
    id: userMessageId,
    chatId,
    role: "user",
    text: prompt,
    createdAt: now,
  });

  const recentMessages = await db.query.message.findMany({
    where: { chatId, role: "assistant" },
    orderBy: { createdAt: "desc" },
    limit: 5,
  });
  const recentMessageId = recentMessages[0]?.id;

  if (recentMessageId) {
    const recentToolCalls = await db.query.toolCall.findMany({
      where: { messageId: recentMessageId },
    });
    const recentQuestion = recentToolCalls.find(
      (tc) => tc.name === "createQuestion" && !tc.result,
    );
    if (recentQuestion) {
      await db
        .update(toolCall)
        .set({ result: prompt })
        .where(eq(toolCall.id, recentQuestion.id));
    }
  }

  // Determine agent based on story phase
  const chatWithStory = await db.query.chat.findFirst({
    with: { story: true },
    where: { id: chatId },
  });
  const isSettingComplete =
    chatWithStory?.story?.type &&
    chatWithStory?.story?.describe &&
    chatWithStory?.story?.worldview;
  const agent = isSettingComplete ? OracleAgent : ArchivistAgent;

  const messages = await getChatMessages(chatId);
  const modelMessages = toModelMessage(messages);

  const stream = createStreamableValue<UIMessageChunk>();

  (async () => {
    const result = await agent.stream({
      messages: modelMessages,
      experimental_context: { db, chatId: chatId, traceId },
      onFinish(event) {
        saveMessageWithTool(assistantMessageId, event, { db, chatId, traceId });
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
    content: stream.value,
  };
}

// RSC 多步骤 https://ai-sdk.dev/docs/ai-sdk-rsc/multistep-interfaces
