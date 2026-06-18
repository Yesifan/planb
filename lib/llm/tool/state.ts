import { tool } from "ai";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

import { DB } from "@/lib/db";
import { protagonistState, story } from "@/lib/db/schema";
import logger from "@/lib/logger";

import { ToolContext } from "../type";

const PROFILE_DESCRIPTION = [
  "主角当前基础状况摘要。只写主角当前的身体/身份状态、所处时间和地点、当前职位或身份，以及一句 30 字以内的大局层面局势概括。",
].join("\n");

const RESOURCES_DESCRIPTION = [
  "主角可用资源清单，使用 Markdown 格式。必须使用 `## 可用资源` 作为标题。",
  "如果主角当前没有任何可用资源，在 `## 可用资源` 下写 `暂无`。",
  "如果存在可用资源，每个资源条目使用 `### 资源名称` 标题，并包含以下内容：",
  "- 描述：资源是什么、当前状态如何。",
  "- 价值：资源在当前局势下的叙事价值或数量。",
  "- 备注：其他需要记录的限制、来源或变化。",
  "更新时必须保留仍然有效的旧资源，移除已经失去、耗尽或不再关键的资源，并反映最新消耗、损失、获得和限制。",
  "示例：",
  "## 资金：100两",
  "## 宝物：八卦图，价值：《使用描述和功能描述》",
].join("\n");

const DIMENSIONS_DESCRIPTION = [
  "由故事类型自动生成的五个主角正向维度。必须正好 5 个，名称不能重复。",
  "维度名称必须适配故事类型，并且高分含义恒好。避免'伤势'、'污染'、'债务'这类高分含义不清的负向维度。",
  "每个 value 必须是 0-100 的整数；数值越高代表主角在该维度越有利。",
  "summary 描述维度的意义和作用，详细说明该数值意味着什么，维度描述要能清楚说明高低分如何影响主角行动和故事推演。",
].join("\n");

const DIMENSION_VALUES_DESCRIPTION = [
  "按已有五维顺序提供 5 个新数值。只能更新数值，不能更改维度名称或描述。",
  "每个值必须是 0-100 的整数；数值变化必须来自最新大纲中的具体事件、资源变化、伤势、声望、机会或风险。",
  "不要为了制造戏剧性随意大幅波动；没有明确变化的维度应保持接近原值。",
].join("\n");

const WORLD_SNAPSHOT_DESCRIPTION = [
  "固定格式的世界快照，是世界当前状态的唯一摘要来源。",
  "必须从世界视角概括当前重要事项，包括主角知道的信息、主角不知道但已经真实发生的暗线、关键势力变化、人物处境和环境状态。",
  "事实只能被新的事实覆盖，不能无故删除或改写；如果信息不足，基于已有事实给出保守状态，不要编造新事件。",
  "必须压缩到最重要事项，避免冗长细节、氛围描写、作者旁白和未来预告。",
  "推荐使用以下分区：",
  "## 世界当前时点",
  "当前日期/时期、地点、故事所处阶段，以及本轮结束后的整体局势。",
  "## 关键势力",
  "主要势力的当前资源、立场、行动方向、冲突关系和信息掌握情况。",
  "## 关键人物",
  "主角、核心 NPC、敌友和潜在变量人物的当前处境、诉求、承诺、伤亡、位置和态度。",
  "## 关键环境状态",
  "政治、军事、经济、自然、技术、超自然规则、封锁、期限、倒计时等会影响下一步行动的环境条件。",
  "## 已发生的重要事件",
  "保留会影响后续因果的事件、线索、暗线、誓言、证据、任务结果和不可逆变化。",
].join("\n");

const TASK_STATE_DESCRIPTION = [
  "固定 Markdown 格式的任务板。只记录可行动目标，不记录普通事实、氛围变化、纯背景线索或作者提醒。",
  "可行动目标必须满足至少一项：主角后续可以主动推进；有明确完成条件；存在风险、奖励、代价、期限或叙事价值；会影响下一轮选择。",
  "进行中任务要写清目标、当前进度、完成条件、风险/代价、期限/窗口，以及与当前局势的关系。",
  "已结束任务要写清起始目标、最终结果、成败状态，以及对世界、主角资源、人物关系或后续任务的影响。",
  "如果当前没有明确任务，仍输出任务板结构，并在进行中写'暂无'。",
  "推荐模板：",
  "## 进行中",
  "### 任务标题",
  "- 目标：主角需要主动推进什么。",
  "- 进度：已经完成什么，卡在哪里。",
  "- 风险/代价/期限：失败会怎样，窗口期到何时。",
  "## 已结束",
  "### 任务标题",
  "- 结果：完成、失败、放弃或转化。",
  "- 影响：对世界状态、主角资源或后续选择造成什么变化。",
].join("\n");

const protagonistDimensionSchema = z.object({
  name: z.string().min(1),
  value: z.number().int().min(0).max(100),
  summary: z
    .string()
    .min(1)
    .describe(
      "描述维度的意义和作用，详细说明该数值意味着什么，维度描述要能清楚说明高低分如何影响主角行动和故事推演。",
    ),
});

const protagonistStateSchema = z.object({
  profile: z.string().min(1).describe(PROFILE_DESCRIPTION),
  resources: z.string().min(1).describe(RESOURCES_DESCRIPTION),
  dimensions: z
    .array(protagonistDimensionSchema)
    .length(5)
    .refine(
      (dimensions) =>
        new Set(dimensions.map((dimension) => dimension.name)).size ===
        dimensions.length,
      "五维名称不能重复",
    )
    .describe(DIMENSIONS_DESCRIPTION),
});

const updateProtagonistStateSchema = z.object({
  profile: z.string().min(1).describe(PROFILE_DESCRIPTION),
  resources: z.string().min(1).describe(RESOURCES_DESCRIPTION),
  dimensionValues: z
    .array(z.number().int().min(0).max(100))
    .length(5)
    .describe(DIMENSION_VALUES_DESCRIPTION),
});

const worldSnapshotSchema = z.object({
  worldSnapshot: z.string().min(1).describe(WORLD_SNAPSHOT_DESCRIPTION),
});

const taskStateSchema = z.object({
  taskState: z.string().min(1).describe(TASK_STATE_DESCRIPTION),
});

export type ProtagonistStateInput = z.infer<typeof protagonistStateSchema>;
export type UpdateProtagonistStateInput = z.infer<
  typeof updateProtagonistStateSchema
>;
export type WorldSnapshotInput = z.infer<typeof worldSnapshotSchema>;
export type TaskStateInput = z.infer<typeof taskStateSchema>;

export async function initializeProtagonistStateData(
  db: DB,
  chatId: string,
  input: ProtagonistStateInput,
) {
  const state = protagonistStateSchema.parse(input);
  const now = new Date();
  await db.insert(protagonistState).values({
    id: nanoid(),
    chatId,
    profile: state.profile,
    resources: state.resources,
    dimensions: state.dimensions,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateProtagonistStateData(
  db: DB,
  chatId: string,
  input: UpdateProtagonistStateInput,
) {
  const state = updateProtagonistStateSchema.parse(input);
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
      resources: state.resources,
      dimensions,
      updatedAt: new Date(),
    })
    .where(eq(protagonistState.chatId, chatId));
}

export async function updateWorldSnapshotData(
  db: DB,
  chatId: string,
  input: WorldSnapshotInput,
) {
  const { worldSnapshot } = worldSnapshotSchema.parse(input);
  await db.update(story).set({ worldSnapshot }).where(eq(story.chatId, chatId));
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

export const initializeProtagonistState = tool({
  description:
    "初始化主角结构化状态。调用时必须同时提供完整 profile、resources 和五个 dimensions。",
  inputSchema: protagonistStateSchema,
  async execute(input, { experimental_context }) {
    const { db, chatId, traceId } = experimental_context as ToolContext;
    logger
      .child({
        traceId: traceId ?? "unknown",
        tool: "initializeProtagonistState",
      })
      .info({ chatId }, "tool.initializeProtagonistState");
    await initializeProtagonistStateData(db, chatId, input);
    return "初始化主角状态成功";
  },
});

export const updateProtagonistState = tool({
  description:
    "根据最新大纲更新主角 profile、resources 和五维数值。已有五维的名称和描述由系统保留，工具只接收并应用每维 value。",
  inputSchema: updateProtagonistStateSchema,
  async execute(input, { experimental_context }) {
    const { db, chatId, traceId } = experimental_context as ToolContext;
    logger
      .child({ traceId: traceId ?? "unknown", tool: "updateProtagonistState" })
      .info({ chatId }, "tool.updateProtagonistState");
    await updateProtagonistStateData(db, chatId, input);
    return "更新主角状态成功";
  },
});

export const updateWorldSnapshot = tool({
  description:
    "根据最新大纲单独更新世界当前快照，将重要的世界事件，局势变化持久化到世界快照中。",
  inputSchema: worldSnapshotSchema,
  async execute(input, { experimental_context }) {
    const { db, chatId, traceId } = experimental_context as ToolContext;
    logger
      .child({ traceId: traceId ?? "unknown", tool: "updateWorldSnapshot" })
      .info({ chatId }, "tool.updateWorldSnapshot");
    await updateWorldSnapshotData(db, chatId, input);
    return "更新世界快照成功";
  },
});

export const initializeTaskState = tool({
  description: "初始化任务系统文本。允许初始化为空任务板；开局必须设置开局任务",
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
  description:
    "根据最新大纲维护任务列表。按当前局势重写完整任务板，包括新建任务、更新进度、标记完成或失败。",
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
