"use server";

import { notFound, unauthorized } from "next/navigation";
import { performance } from "perf_hooks";

import { getSessionWithRedirect } from "@/lib/auth/server";
import { db } from "@/lib/db";
import logger from "@/lib/logger";

export async function getChatWithStory(chatId: string) {
  const start = performance.now();
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
  } finally {
    logger.info(
      {
        duration: performance.now() - start,
      },
      "getChatWithStory",
    );
  }
}

export async function getChatMessages(chatId: string, limit = 100, offset = 0) {
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
    const messages = (
      await db.query.message.findMany({
        with: {
          toolCalls: true,
        },
        where: {
          chatId: chatId,
        },
        orderBy: {
          createdAt: "desc",
        },
        offset: offset,
        limit: limit,
      })
    ).reverse();
    // logger.info(messages, "getChatMessages.messages");
    return messages;
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

export async function getLastestChatMessage(chatId: string) {
  const session = await getSessionWithRedirect();
  const chat = await db.query.chat.findFirst({
    where: {
      id: chatId,
      userId: session.user.id,
    },
  });
  if (!chat) {
    return notFound();
  }
  return await db.query.message.findFirst({
    with: {
      toolCalls: true,
    },
    where: {
      chatId: chatId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getUserChats(options?: {
  cursor?: { updatedAt: Date; id: string };
  limit?: number;
}) {
  const session = await getSessionWithRedirect();
  const userId = session.user.id;
  const limit = options?.limit ?? 20;
  const cursor = options?.cursor;

  const chats = await db.query.chat.findMany({
    where: {
      userId,
      ...(cursor && {
        OR: [
          { updatedAt: { lt: cursor.updatedAt } },
          {
            AND: [
              { updatedAt: { eq: cursor.updatedAt } },
              { id: { lt: cursor.id } },
            ],
          },
        ],
      }),
    },
    orderBy: {
      updatedAt: "desc",
      id: "desc",
    },
    limit: limit + 1,
  });

  const hasMore = chats.length > limit;
  const items = hasMore ? chats.slice(0, limit) : chats;
  const last = items.at(-1);
  const nextCursor = hasMore && last
    ? { updatedAt: last.updatedAt, id: last.id }
    : null;

  return { chats: items, nextCursor };
}

export async function getChatHistory(chatId: string, limit = 100, offset = 0) {
  const session = await getSessionWithRedirect();
  const chat = await db.query.chat.findFirst({
    where: {
      id: chatId,
      userId: session.user.id,
    },
  });
  if (!chat) {
    return notFound();
  }
  const history = (
    await db.query.history.findMany({
      where: {
        chatId: chatId,
      },
      orderBy: {
        createdAt: "desc",
      },
      offset: offset,
      limit: limit,
    })
  ).reverse();

  return history;
}
