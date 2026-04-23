"use server";
import { validateTypes } from "@ai-sdk/provider-utils";
import { nanoid } from "nanoid";
import { notFound, unauthorized } from "next/navigation";

import { getSessionWithRedirect } from "@/lib/auth/server";
import { db } from "@/lib/db";
import type { Chat, Message, Story } from "@/lib/db/schema";
import { chat, story } from "@/lib/db/schema";
import { ArchivistAgent } from "@/lib/llm";
import Tools, { ToolNames } from "@/lib/llm/tool";

export interface ChatWithStory {
  chat: Chat;
  story: Story;
}

export async function createStory(source: string, singularity: string) {
  // 1. Input Validation
  if (!source || source.trim().length === 0) {
    throw new Error("Story source cannot be empty");
  }
  if (!singularity || singularity.trim().length === 0) {
    throw new Error("Singularity cannot be empty");
  }

  // 2. Session Validation
  const session = await getSessionWithRedirect();

  try {
    // 3. Call Archivist Agent with output schema validation
    const prompt = `source: ${source}\n singularity: ${singularity}`;

    const result = await ArchivistAgent.generate({
      prompt,
      experimental_context: { db },
    });

    const createStoryToolCall = result.toolCalls.find(
      (toolcall) => toolcall.toolName === ToolNames.createStory,
    );

    if (!createStoryToolCall) {
      throw new Error("The Agent not call create story tool!");
    }
    const output = await validateTypes({
      value: createStoryToolCall.input,
      schema: Tools.createStory.inputSchema,
    });

    // 4. Database Operations - Create chat first, then story
    const chatId = nanoid();
    const storyId = nanoid();
    const now = new Date();

    // First insert into chat table
    await db.insert(chat).values({
      id: chatId,
      userId: session.user.id,
      title: output.title, // Use first 50 chars of source as title
      createdAt: now,
      updatedAt: now,
    });

    // Then insert into story table
    await db.insert(story).values({
      id: storyId,
      chatId,
      source,
      singularity,
      type: output.type,
      describe: output.describe,
      worldview: output.worldview,
      createdAt: now,
      updatedAt: now,
    });

    // 5. Return result
    return chatId;
  } catch (error) {
    console.log(error);
    console.error("Error in createStory:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to create story. Please try again.");
  }
}

export async function getChatWithStory(
  chatId: string,
): Promise<ChatWithStory | null> {
  const session = await getSessionWithRedirect();

  try {
    const chat = await db.query.chat.findFirst({
      where: {
        id: chatId,
      },
    });

    if (!chat) {
      return notFound();
    }
    if (chat.userId !== session.user.id) {
      return unauthorized();
    }

    const story = await db.query.story.findFirst({
      where: {
        chatId: chatId,
      },
    });

    if (!story) {
      throw new Error(
        `There is not found corresponding story for chat(id:${chatId}).`,
      );
    }

    return { chat: chat, story: story };
  } catch (error) {
    console.error("Error fetching chat with story:", error);
    throw new Error("Failed to load chat data");
  }
}

export async function getChatMessages(chatId: string): Promise<Message[]> {
  const session = await getSessionWithRedirect();

  try {
    const chat = await db.query.chat.findFirst({
      where: {
        id: chatId,
        userId: session.user.id,
      },
    });
    if (!chat) {
      return notFound();
    }
    return await db.query.messages.findMany({
      where: {
        chatId: chatId,
      },
    });
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    throw new Error("Failed to load messages");
  }
}
