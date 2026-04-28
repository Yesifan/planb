"use server";

import { notFound, unauthorized } from "next/navigation";
import { performance } from "perf_hooks";

import { getSessionWithRedirect } from "@/lib/auth/server";
import { db } from "@/lib/db";
import logger from "@/lib/logger";

export async function getChatWithStory(chatId: string) {
  const session = await getSessionWithRedirect();

  try {
    const chat = await db.query.chat.findFirst({
      with: {
        story: true,
      },
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

    return chat;
  } catch (error) {
    logger.error({ chatId, error }, "db.query.error");
    throw new Error("Failed to load chat data");
  }
}

export async function getChatMessages(chatId: string) {
  const start = performance.now();
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
      with: {
        toolCalls: true,
      },
      where: {
        chatId: chatId,
      },
      orderBy: {
        createdAt: "desc",
      },
      limit: 10,
    });
  } catch (error) {
    logger.error({ chatId, error }, "getChatMessages.error");
    throw error;
  } finally {
    logger.info(
      {
        duration: performance.now() - start,
      },
      "getChatMessages",
    );
  }
}
