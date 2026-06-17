import { tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { chat, story } from "@/lib/db/schema";
import logger from "@/lib/logger";

import { ToolContext } from "../type";

export const CreateStorySchema = z.object({
  title: z.string().min(1),
  type: z.string().min(1, "Story type"),
  worldview: z
    .string()
    .min(
      1,
      "世界设定——持续性的世界背景：物理法则、历史、地理、制度、规则边界、NPC画像",
    ),
});

export const createStory = tool({
  description:
    "接收用户提供的「故事来源」和「特异点」，生成一个逻辑自洽、细节丰满的特异点世界的世界设定",
  inputSchema: CreateStorySchema,
  async execute(input, { experimental_context }) {
    const { db, chatId, traceId } = experimental_context as ToolContext;
    const log = logger.child({
      traceId: traceId ?? "unknown",
      tool: "createStory",
    });
    try {
      log.info({ input: JSON.stringify(input) }, "Tool CreateStory");
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

export const SaveSystemSettingSchema = z.object({
  system: z
    .string()
    .min(1, "金手指设定不能为空")
    .describe("完整的金手指设定内容"),
});

export const saveSystemSetting = tool({
  description:
    "当金手指设定生成完成后，调用本工具将设定保存到故事中。保存后设定可被 System Agent 在主流程中读取和使用。",
  inputSchema: SaveSystemSettingSchema,
  async execute(input, { experimental_context }) {
    const { db, chatId, traceId } = experimental_context as ToolContext;
    const log = logger.child({
      traceId: traceId ?? "unknown",
      tool: "saveSystemSetting",
    });
    try {
      log.info({ input: input.system }, "tool.saveSystemSetting");
      await db
        .update(story)
        .set({ system: input.system })
        .where(eq(story.chatId, chatId));
      log.info({ chatId }, "tool.saveSystemSetting.end");
      return "保存成功！";
    } catch (error) {
      log.error({ error }, "tool.saveSystemSetting.error");
      throw error;
    }
  },
});
