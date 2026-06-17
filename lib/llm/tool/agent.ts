import { ModelMessage, tool } from "ai";
import { z } from "zod";

import { db } from "@/lib/db";

import { ToolContext } from "../type";
import { addUsage } from "../usage";
import {
  toHistoryModelMessage,
  toRuntimeStateModelMessage,
  toStoryModelMessage,
} from "../utils";

const ACTIVATE_SYSTEM_DESCRIPTION = [
  "当剧情中金手指/系统需要介入时调用。",
  "调用条件：主角触发系统设定中的条件；当前节点适合发布任务、更新任务或发放奖励；主角面临抉择且系统能提供隐藏路径、代价提示或规则反馈；主角触碰系统能力边界或违规风险。",
  "不调用条件：当前剧情不涉及系统；主角没有触发条件；系统介入会打断自然因果；近期已连续介入导致节奏过密。",
  "返回内容必须作为世界内真实事件融入剧情草案，并写清它造成的直接后果。",
].join("\n");

const EX_MACHINA_DESCRIPTION = [
  "当用户明确需要金手指、系统或作弊能力时调用。",
  "本工具会把世界观和用户需求交给 ExMachina Agent，设计与世界底层逻辑兼容的完整金手指体系。",
  "生成内容必须包含本源、核心能力、交互方式、任务机制、奖励机制、与世界关联，并最终通过 saveSystemSetting 保存到故事中。",
  "不要在用户没有表达相关需求时主动调用。",
].join("\n");

const REVIEW_BRANCH_DESCRIPTION = [
  "调用本工具对大纲进行事实一致性审查，并返回最小修改建议。",
  "content 应包含玩家操作、完整故事大纲草案、故事设定、运行状态、任务状态、历史事实、人物关系、地点、期限、资源、承诺、暗线依据和决策岔口停止理由等关键上下文。",
  "本工具检查时间线、任务状态、角色 OOC、世界规则、已建立事实和因果链冲突。",
].join("\n");

export const ActivateSystemSchema = z.object({
  trigger: z
    .string()
    .describe(
      "触发原因。写清当前剧情中什么具体情况触发了金手指介入，例如：主角触发系统条件、到达适合发布/更新任务或奖励的节点、面临抉择需要隐藏路径/代价提示/规则反馈、触碰系统能力边界或违规风险。",
    ),
  currentSituation: z
    .string()
    .describe(
      "当前剧情状态和主角处境摘要。必须包含相关世界规则、运行状态、任务状态、地点、时间、主角资源/限制、当前风险，以及系统介入后需要影响的具体局面。",
    ),
});

export const activateSystem = tool({
  description: ACTIVATE_SYSTEM_DESCRIPTION,
  inputSchema: ActivateSystemSchema,
  async execute(input, { experimental_context }) {
    const { chatId, tokenUsage } = experimental_context as ToolContext;
    const storyData = await db.query.story.findFirst({
      where: { chatId },
    });
    const protagonistData = await db.query.protagonistState.findFirst({
      where: { chatId },
    });
    if (storyData?.system) {
      const { system: systemAgent } = await import("../index");
      const storyMessage = toStoryModelMessage(storyData);
      const runtimeStateMessage = toRuntimeStateModelMessage({
        protagonistState: protagonistData,
        story: storyData,
      });
      const result = await systemAgent.generate({
        prompt: [
          storyMessage,
          runtimeStateMessage,
          {
            role: "user",
            content: `## 当前剧情状态\n${input.currentSituation}\n\n## 触发原因\n${input.trigger}\n\n请根据以上情境进行介入。`,
          },
        ].filter((m): m is ModelMessage => m !== undefined),
        experimental_context,
      });
      if (tokenUsage) addUsage(tokenUsage, result.totalUsage);
      return result.text;
    }
    return "系统设定不存在！";
  },
});

export const ExMachinaSchema = z.object({
  worldview: z
    .string()
    .describe(
      "故事的世界观设定。必须提供故事类型、世界背景、关键设定、特异点、规则边界和风格基调，供 ExMachina 设计与世界底层逻辑兼容的金手指体系。",
    ),
  userRequirement: z
    .string()
    .describe(
      "用户对金手指/系统功能的期望和需求，可能明确也可能模糊。应包含用户想要的能力类型、触发方式、限制条件、风格偏好、是否需要任务/奖励机制，以及任何不想要的元素。",
    ),
});

export const exMachina = tool({
  description: EX_MACHINA_DESCRIPTION,
  inputSchema: ExMachinaSchema,
  async execute(input, { experimental_context }) {
    const { exMachina: exMachinaAgent } = await import("../index");
    const result = await exMachinaAgent.generate({
      prompt: [
        {
          role: "system",
          content: ["# 故事设定", `## 世界观设定\n${input.worldview}`].join(
            "\n",
          ),
        },
        {
          role: "user",
          content: `## 用户需求\n${input.userRequirement}\n\n请根据以上信息生成完整的金手指设定，完成后调用 saveSystemSetting 工具保存。`,
        },
      ],
      experimental_context,
    });
    const { tokenUsage } = experimental_context as ToolContext;
    if (tokenUsage) addUsage(tokenUsage, result.totalUsage);
    return result.text;
  },
});

export const reviewBranch = tool({
  description: REVIEW_BRANCH_DESCRIPTION,
  inputSchema: z.object({
    content: z
      .string()
      .describe(
        "待审查材料。建议包含：1. 玩家操作；2. 完整故事大纲；3. 关键上下文，如世界规则、历史事实、运行状态、任务状态、人物关系、地点、期限、资源、承诺、暗线依据和决策岔口停止理由。",
      ),
  }),
  async execute({ content }, { experimental_context }) {
    const { chatId, tokenUsage } = experimental_context as ToolContext;
    const storyData = await db.query.story.findFirst({
      where: { chatId },
    });

    const { arbiter } = await import("../index");
    const result = await arbiter.generate({
      prompt:
        `## 故事背景 ${storyData?.worldview}` +
        `## 世界快照 ${storyData?.worldSnapshot}` +
        `## 待审查材料\n${content}` +
        "请审查大纲是否存在事实一致性问题，并给出最小修改建议。不要创作新剧情，不要扩写正文。",
      experimental_context,
    });
    if (tokenUsage) addUsage(tokenUsage, result.totalUsage);
    return result.text;
  },
});

export const agentTools = {
  activateSystem,
  exMachina,
  reviewBranch,
} as const;
