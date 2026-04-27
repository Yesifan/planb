"use server";

import { notFound, unauthorized } from "next/navigation";

import { getSessionWithRedirect } from "@/lib/auth/server";
import { db } from "@/lib/db";
import type { Chat, Message, Story } from "@/lib/db/schema";
import logger from "@/lib/logger";

export interface ChatWithStory {
  chat: Chat;
  story: Story;
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
    logger.error(
      { action: "getChatWithStory", chatId, error },
      "db.query.error",
    );
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
    return await db.query.message.findMany({
      where: {
        chatId: chatId,
      },
    });
  } catch (error) {
    logger.error({ chatId, error }, "getChatMessages.error");
    throw error;
  }
}
