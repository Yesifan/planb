import { tool } from "ai";
import { z } from "zod";

export const CreateStorySchema = z.object({
  title: z.string().min(1),
  type: z.string().min(1, "Story type cannot be empty"),
  describe: z.string().min(1, "Story description cannot be empty"),
  worldview: z.string().min(1, "Worldview cannot be empty"),
});

export const createStory = tool({
  description:
    "接收用户提供的「故事来源」和「特异点」，生成一个逻辑自洽、细节丰满的异世界世界观",
  inputSchema: CreateStorySchema,
});
