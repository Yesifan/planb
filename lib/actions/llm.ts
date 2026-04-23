"use server";
import { validateTypes } from "@ai-sdk/provider-utils";
import { createStreamableValue } from "@ai-sdk/rsc";
import { nanoid } from "nanoid";

import { db } from "@/lib/db";
import { ArchivistAgent } from "@/lib/llm";

import { getSessionWithRedirect } from "../auth/server";
import { chat, story } from "../db/schema";
import Tools, { ToolNames } from "../llm/tool";

interface AgentContext {
  chatId: string;
}

export async function createStory(source: string, singularity: string) {
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

    const result = await ArchivistAgent.generate({
      prompt,
      experimental_context: { db },
    });

    const createQuestionToolCall = result.toolCalls.find(
      (toolcall) => toolcall.toolName === ToolNames.createQuestion,
    );

    if (!createQuestionToolCall) {
      throw new Error("The Agent not call create story tool!");
    }
    const output = validateTypes({
      value: createQuestionToolCall.input,
      schema: Tools.createQuestion.inputSchema,
    });

    // 5. Return result
    return [chatId, output];
  } catch (error) {
    console.log(error);
    console.error("Error in createStory:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to create story. Please try again.");
  }
}

export async function createStoryContinue(chatid: string, prompt: string) {
  const session = await getSessionWithRedirect();
}

export async function continueConversation(chatId: string, prompt: string) {
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
      experimental_context: { db, chatId: chatId },
    });

    for await (const text of textStream) {
      stream.update(text);
    }

    stream.done();
  })();

  return stream.value;
}
