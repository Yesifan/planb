"use server";

import { createStreamableValue } from "@ai-sdk/rsc";
import { nanoid } from "nanoid";

import { db } from "@/lib/db";
import { ArchivistAgent } from "@/lib/llm";
import logger from "@/lib/logger";

import { getSessionWithRedirect } from "../auth/server";
import { chat, messages, story } from "../db/schema";

export async function createStory(source: string, singularity: string) {
  const traceId = nanoid();
  const log = logger.child({ traceId, action: "createStory" });

  log.info({ source, singularity }, "action.createStory.start");

  const session = await getSessionWithRedirect();

  try {
    const prompt = `source: ${source}\n singularity: ${singularity}`;

    const chatId = nanoid();
    const storyId = nanoid();
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

    const { toolCalls, text } = await ArchivistAgent.generate({
      prompt,
      experimental_context: { db, traceId },
      async onFinish({ text, reasoning, totalUsage, model }) {
        const now = new Date();
        const reasoningText = reasoning.reduce((acc, reason) => {
          return acc + reason.text;
        }, "");

        await db.insert(messages).values({
          id: nanoid(),
          chatId: chatId,
          role: "assistant",
          content: text,
          reasoning: reasoningText,
          inputTokens: totalUsage?.inputTokens,
          outputTokens: totalUsage?.outputTokens,
          agent: "Archivist",
          model: typeof model === "string" ? model : model?.modelId,
          createdAt: now,
        });
      },
    });

    log.info(
      { chatId, toolCallsCount: toolCalls.length },
      "action.createStory.end",
    );

    // 5. Return result
    return {
      id: chatId,
      toolCalls: toolCalls,
      text: text,
    };
  }    catch (error) {
    log.error({ error }, "action.createStory.error");
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to create story. Please try again.");
  }
}

// API 参考 https://ai-sdk.dev/cookbook/rsc/stream-text#stream-text
export async function continueConversation(chatId: string, prompt: string) {
  const traceId = nanoid();
  const log = logger.child({ traceId, action: "continueConversation" });

  log.info({ chatId, prompt }, "action.continueConversation.start");

  // const history = await db.query.messages.findMany({
  //   where: {
  //     chatId: chatId,
  //     NOT: {
  //       role: "tool",
  //     },
  //   },
  //   orderBy: {
  //     createdAt: "desc",
  //   },
  //   limit: 10,
  // });

  // const messages = history.reverse().map((message) => ({
  //   role: message.role,
  //   content: message.content,
  // })) as ModelMessage[];

  const stream = createStreamableValue();

  (async () => {
    const { textStream } = await ArchivistAgent.stream({
      messages: [
        // ...messages,
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

    for await (const text of textStream) {
      stream.update(text);
    }

    stream.done();
  })();

  return stream.value;
}

// RSC 多步骤 https://ai-sdk.dev/docs/ai-sdk-rsc/multistep-interfaces
