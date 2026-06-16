import { tool } from "ai";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

import { DB } from "@/lib/db";
import { protagonistState, story } from "@/lib/db/schema";
import logger from "@/lib/logger";

import { ToolContext } from "../type";

const protagonistDimensionSchema = z.object({
  name: z.string().min(1),
  value: z.number().int().min(0).max(100),
  summary: z.string().min(1),
});

const storyStateSchema = z.object({
  profile: z.string().min(1).describe("主角身份、处境、当前目标的简短摘要"),
  dimensions: z
    .array(protagonistDimensionSchema)
    .length(5)
    .refine(
      (dimensions) =>
        new Set(dimensions.map((dimension) => dimension.name)).size ===
        dimensions.length,
      "五维名称不能重复",
    )
    .describe("由故事类型自动生成的五个主角正向维度，0-100 且高分恒好"),
  worldSnapshot: z.string().min(1).describe("固定 Markdown 格式的当前世界快照"),
});

const updateStoryStateSchema = z.object({
  profile: z.string().min(1).describe("主角身份、处境、当前目标的简短摘要"),
  dimensionValues: z
    .array(z.number().int().min(0).max(100))
    .length(5)
    .describe(
      "按已有五维顺序提供五个新数值。只能更新数值，不能更改维度名称或描述。",
    ),
  worldSnapshot: z.string().min(1).describe("固定 Markdown 格式的当前世界快照"),
});

const taskStateSchema = z.object({
  taskState: z
    .string()
    .min(1)
    .describe("任务描述，使用 MardDown 格式分区分任务描述任务进度"),
});

export type StoryStateInput = z.infer<typeof storyStateSchema>;
export type UpdateStoryStateInput = z.infer<typeof updateStoryStateSchema>;
export type TaskStateInput = z.infer<typeof taskStateSchema>;

export async function initializeStoryStateData(
  db: DB,
  chatId: string,
  input: StoryStateInput,
) {
  const state = storyStateSchema.parse(input);
  const now = new Date();
  await db.insert(protagonistState).values({
    id: nanoid(),
    chatId,
    profile: state.profile,
    dimensions: state.dimensions,
    createdAt: now,
    updatedAt: now,
  });
  await db
    .update(story)
    .set({ worldSnapshot: state.worldSnapshot })
    .where(eq(story.chatId, chatId));
}

export async function updateStoryStateData(
  db: DB,
  chatId: string,
  input: UpdateStoryStateInput,
) {
  const state = updateStoryStateSchema.parse(input);
  const existing = await db.query.protagonistState.findFirst({
    where: { chatId },
  });
  if (!existing) {
    throw new Error("protagonist state does not exist");
  }
  const dimensions = existing.dimensions.map((dimension, index) => ({
    ...dimension,
    value: state.dimensionValues[index] ?? dimension.value,
  }));
  await db
    .update(protagonistState)
    .set({
      profile: state.profile,
      dimensions,
      updatedAt: new Date(),
    })
    .where(eq(protagonistState.chatId, chatId));
  await db
    .update(story)
    .set({ worldSnapshot: state.worldSnapshot })
    .where(eq(story.chatId, chatId));
}

export async function initializeTaskStateData(
  db: DB,
  chatId: string,
  input: TaskStateInput,
) {
  await db
    .update(story)
    .set({ taskState: taskStateSchema.parse(input).taskState })
    .where(eq(story.chatId, chatId));
}

export async function updateTaskStateData(
  db: DB,
  chatId: string,
  input: TaskStateInput,
) {
  await initializeTaskStateData(db, chatId, input);
}

export const initializeStoryState = tool({
  description:
    "初始化主角五维结构化状态和世界当前快照。只能在故事设定完成后调用一次。",
  inputSchema: storyStateSchema,
  async execute(input, { experimental_context }) {
    const { db, chatId, traceId } = experimental_context as ToolContext;
    logger
      .child({ traceId: traceId ?? "unknown", tool: "initializeStoryState" })
      .info({ chatId }, "tool.initializeStoryState");
    await initializeStoryStateData(db, chatId, input);
    return "初始化故事运行状态成功";
  },
});

export const updateStoryState = tool({
  description:
    "根据最新 Oracle 大纲更新主角五维数值和世界当前快照。已有五维的名称和描述由系统保留，工具只接收并应用每维 value。",
  inputSchema: updateStoryStateSchema,
  async execute(input, { experimental_context }) {
    const { db, chatId, traceId } = experimental_context as ToolContext;
    logger
      .child({ traceId: traceId ?? "unknown", tool: "updateStoryState" })
      .info({ chatId }, "tool.updateStoryState");
    await updateStoryStateData(db, chatId, input);
    return "更新故事运行状态成功";
  },
});

export const initializeTaskState = tool({
  description: "初始化任务系统文本。允许初始化为空任务板。",
  inputSchema: taskStateSchema,
  async execute(input, { experimental_context }) {
    const { db, chatId, traceId } = experimental_context as ToolContext;
    logger
      .child({ traceId: traceId ?? "unknown", tool: "initializeTaskState" })
      .info({ chatId }, "tool.initializeTaskState");
    await initializeTaskStateData(db, chatId, input);
    return "初始化任务状态成功";
  },
});

export const updateTaskState = tool({
  description: "根据最新大纲维护任务列表：新建任务、更新进度、标记完成或失败。",
  inputSchema: taskStateSchema,
  async execute(input, { experimental_context }) {
    const { db, chatId, traceId } = experimental_context as ToolContext;
    logger
      .child({ traceId: traceId ?? "unknown", tool: "updateTaskState" })
      .info({ chatId }, "tool.updateTaskState");
    await updateTaskStateData(db, chatId, input);
    return "更新任务状态成功";
  },
});
