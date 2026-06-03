import { ModelMessage, tool } from "ai";
import { z } from "zod";

import { db } from "@/lib/db";

import { ToolContext } from "../type";
import { addUsage } from "../usage";
import { toHistoryModelMessage, toStoryModelMessage } from "../utils";

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
    if (storyData?.system) {
      const { system: systemAgent } = await import("../index");
      const storyMessage = toStoryModelMessage(storyData);
      const result = await systemAgent.generate({
        prompt: [
          storyMessage,
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
    "调用裁决者 Arbiter 对故事推演进行逻辑审查与打分。content 不能只传故事大纲，必须同时包含大纲生成依据、骰子调用记录、骰子结果解释、关键推理过程和自检说明，方便 Arbiter 判断难度、因果、时间线和人物行为是否成立。",
  inputSchema: z.object({
    content: z
      .string()
      .describe(
        "待审查材料。必须包含：1. 玩家操作；2. 完整故事推演大纲；3. 骰子记录（每次 dice 的 reason 原文、点数、目标、预估难度/DC、结果解释）；4. 大纲推理过程（关键因果链、人物动机、时间线、暗线依据、为什么停在该决策岔口）；5. 自检说明（哪些地方可能有争议，需要 Arbiter 重点看）。",
      ),
  }),
  async execute({ content }, { experimental_context }) {
    const { chatId, tokenUsage } = experimental_context as ToolContext;
    const storyData = await db.query.story.findFirst({
      where: { chatId },
    });
    const histories = (
      await db.query.history.findMany({
        where: { chatId },
        orderBy: { createdAt: "desc" },
      })
    ).reverse();
    const storyMessage = toStoryModelMessage(storyData);
    const historyMessage = toHistoryModelMessage(histories);
    const { arbiter } = await import("../index");
    const result = await arbiter.generate({
      prompt: [
        storyMessage,
        historyMessage,
        {
          role: "user",
          content: `## 待审查材料\n${content}\n\n请综合故事推演、骰子记录、结果解释和推理过程进行逻辑审查与打分。不要只审查最终大纲表面文本。`,
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
