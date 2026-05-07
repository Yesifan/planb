import { tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { DB } from "@/lib/db";
import { chat, story } from "@/lib/db/schema";
import logger, { truncateContent } from "@/lib/logger";

export const CreateStorySchema = z.object({
  title: z.string().min(1),
  type: z.string().min(1, "Story type"),
  describe: z.string().min(1, "世界详情，需要描述特异点，主角以及其他重要设定"),
  worldview: z.string().min(1, "世界观，完整的描述故事中的世界"),
});

export const createStory = tool({
  description:
    "接收用户提供的「故事来源」和「特异点」，生成一个逻辑自洽、细节丰满的异世界世界观",
  inputSchema: CreateStorySchema,
  async execute(input, { experimental_context }) {
    const { db, chatId, traceId } = experimental_context as {
      db: DB;
      chatId: string;
      traceId?: string;
    };
    const log = logger.child({
      traceId: traceId ?? "unknown",
      tool: "createStory",
    });
    try {
      log.info(
        { input: truncateContent(JSON.stringify(input)) },
        "Tool CreateStory",
      );
      await db
        .update(chat)
        .set({
          title: input.title,
        })
        .where(eq(chat.id, chatId));
      await db
        .update(story)
        .set({
          type: input.type,
          describe: input.describe,
          worldview: input.worldview,
        })
        .where(eq(story.chatId, chatId));
      log.info({ chatId }, "tool.createStory.end");
      return "Create Success!";
    } catch (error) {
      log.error({ error }, "tool.createStory.error");
      throw error;
    }
  },
});
