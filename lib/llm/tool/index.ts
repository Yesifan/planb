import { tool, ToolSet } from "ai";
import z from "zod";

import {
  initializeStoryState,
  initializeTaskState,
  updateStoryState,
  updateTaskState,
} from "./state";
import { createStory, saveSystemSetting } from "./story";

const DICE_REASON_DESCRIPTION = [
  "本次检定的完整上下文。必须包含以下信息：",
  "- 目标：主角想改变什么。",
  "- 行动：主角具体怎么做，而不是抽象愿望。",
  "- 风险：为什么可能失败，失败会造成什么有意义后果。",
  "- 难度：参考 DC 或难度等级。",
  "- 修正因素：主角能力、五维状态、准备、工具、环境、敌方警觉、资源消耗等。",
  "如果运行状态没有主角五维，说明按世界规则与已知能力估算。",
  "示例：目标：无声进入档案室并取得名单；行动：夜间潜入并撬锁；风险：巡逻密集，失败会触发警戒；难度：DC 10 困难；修正因素：有平面图但没有钥匙。",
].join("\n");

const CREATE_QUESTION_DESCRIPTION = [
  "当需要用户提供更多信息才能继续构建世界观时，使用本工具向用户提问。",
  "每次提问应附上当前已生成设定的简要描述，方便用户理解你正在构建什么、可以调整哪里。",
  "通常需要确认：用户想扮演的角色、故事开始时间/节点、主角初始处境、用户对系统/金手指的需求，以及基于故事来源和特异点产生的关键分歧。",
  "问题必须具体、少量、可回答；不要问空泛问题。",
  "用户已经明确提供的信息不要重复询问。",
  "可以一次性提出多个问题，但每个问题都应有明确目的。",
].join("\n");

const JUDGE_INPUT_DESCRIPTION = [
  "用户输入审查工具。每次用户输入必须且只能调用一次本工具，给出 approve 或 reject。",
  "默认 approve。只有出现明确硬伤时才 reject。",
  "reject 场景包括：空输入、乱码、纯寒暄、与故事无关；明确违反世界规则、能力上限或技术水平；严重 OOC；时间线矛盾；用户试图直接决定 NPC/势力/世界事件结果。",
  "approve 时只标准化用户已经表达的行动意图、目标、条件、方案、承诺和当前上下文可确定的时间地点。",
  "禁止在 approve 内容中写入 NPC 反应、行动结果、环境描写、心理活动、成功/失败判断或用户未说出的内容。",
].join("\n");

export const dice = tool({
  description:
    "扔骰子。1个16面骰子取最大点数，返回1-16的结果。调用时必须在 reason 中写清：检定目标、主角具体行动、为什么有不确定性、失败后果、预估难度/DC、影响判定的准备/资源/环境。",
  inputSchema: z.object({
    title: z.string().describe("本次检定的标题"),
    reason: z.string().describe(DICE_REASON_DESCRIPTION),
  }),
  async execute({ title }) {
    const roll = () => Math.floor(Math.random() * 16) + 1;
    const max = Math.max(roll(), roll());

    return `${title} dice result: ${max}`;
  },
});

const createQuestionSchema = z.object({
  title: z.string().describe("本次提问的标题"),
  describe: z
    .string()
    .describe(
      "简要复述当前已生成的初步设定、你准备如何发展它，以及还需要用户补充什么。不要写最终设定。",
    )
    .optional(),
  questions: z.array(
    z.object({
      question: z
        .string()
        .describe(
          "一个简短、具体、可回答的问题。优先询问扮演角色、开始时间/节点、初始处境、系统/金手指需求或影响世界线的关键选择。",
        ),
      describe: z
        .string()
        .describe("问题的补充说明，提示前因后果，帮助用户理解需要提供什么信息")
        .optional(),
    }),
  ),
});

const createQuestion = tool({
  description: CREATE_QUESTION_DESCRIPTION,
  inputSchema: createQuestionSchema,
});
export type CreateQuestion = z.infer<typeof createQuestionSchema>;

const judgeInput = tool({
  description: JUDGE_INPUT_DESCRIPTION,
  inputSchema: z.object({
    decision: z
      .enum(["approve", "reject"])
      .describe(
        "审查结论。approve 表示输入可以进入剧情推演；reject 表示输入存在明确硬伤，需要用户重新输入。默认 approve，只有明确违反规则、严重 OOC、时间线矛盾、空乱码或无关输入才 reject。",
      ),
    content: z
      .string()
      .describe(
        "approve 时填写标准化后的用户输入，格式：<时间·地点>，主角<本轮行动意图>。只包含用户已表达内容和上下文已确定的时间地点；不要添加结果、NPC 反应、环境描写、扭曲遗漏用户意图或用户未授权行动。reject 时填写清晰拒绝原因和可行改写方向。",
      ),
  }),
});

const Tools = {
  createStory,
  createQuestion,
  dice,
  judgeInput,
  initializeStoryState,
  initializeTaskState,
  saveSystemSetting,
  updateStoryState,
  updateTaskState,
} satisfies ToolSet;

export default Tools;

export const AgentTookKeys = ["activateSystem", "exMachina", "reviewBranch"];

export const ToolKeys = [
  "createStory",
  "createQuestion",
  "dice",
  "judgeInput",
  "initializeStoryState",
  "initializeTaskState",
  "saveSystemSetting",
  "updateStoryState",
  "updateTaskState",
] as const;

export const AllToolKeys = [...ToolKeys, ...AgentTookKeys] as const;

export type MyTools = typeof Tools;
