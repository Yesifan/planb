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

export const ActivateSystemSchema = z.object({
  trigger: z.string().describe("触发原因：当前剧情中什么情况需要金手指介入"),
  currentSituation: z.string().describe("当前剧情状态和主角处境摘要"),
});

export const activateSystem = tool({
  description:
    "当剧情分支中金手指/系统需要介入时，调用本工具激活系统。系统将根据金手指设定和当前情境生成介入内容（任务/选项/奖励/警告），返回的介入结果需要融入该分支的历史年表输出中。",
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
  worldview: z.string().describe("故事的世界观设定"),
  userRequirement: z.string().describe("用户对金手指/系统功能的期望和需求"),
});

export const exMachina = tool({
  description:
    "当用户需要金手指/系统/作弊能力时，调用本工具生成金手指设定。ExMachina 会根据世界观和用户需求设计完整的金手指体系（本源、能力、任务、奖励等），并自动保存到故事中。",
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
  description:
    "调用 Arbiter 对 Oracle 大纲进行事实一致性审查，并返回最小修改建议。content 应包含玩家操作、完整故事大纲和关键上下文，方便 Arbiter 检查时间线、任务状态、角色 OOC、世界设定等事实矛盾，也可指出其他与已建立事实冲突的问题。Arbiter 不评价叙事质量，不替 Oracle 重写大纲。",
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
    const protagonistData = await db.query.protagonistState.findFirst({
      where: { chatId },
    });
    const histories = (
      await db.query.history.findMany({
        where: { chatId },
        orderBy: { createdAt: "desc" },
        limit: 20,
      })
    ).reverse();
    const storyMessage = toStoryModelMessage(storyData);
    const runtimeStateMessage = toRuntimeStateModelMessage({
      protagonistState: protagonistData,
      story: storyData,
    });
    const historyMessage = toHistoryModelMessage(histories);
    const { arbiter } = await import("../index");
    const result = await arbiter.generate({
      prompt: [
        storyMessage,
        runtimeStateMessage,
        historyMessage,
        {
          role: "user",
          content: `## 待审查材料\n${content}\n\n请审查大纲是否存在事实一致性问题，并给出最小修改建议。不要创作新剧情，不要扩写正文。`,
        },
      ].filter((m): m is ModelMessage => m !== undefined),
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
