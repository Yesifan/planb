import { tool } from "ai";
import { z } from "zod";

import { ToolContext } from "../type";

export const ActivateSystemSchema = z.object({
  trigger: z.string().describe("触发原因：当前剧情中什么情况需要金手指介入"),
  currentSituation: z.string().describe("当前剧情状态和主角处境摘要"),
});

export const activateSystem = tool({
  description:
    "当剧情分支中金手指/系统需要介入时，调用本工具激活系统。系统将根据金手指设定和当前情境生成介入内容（任务/选项/奖励/警告），返回的介入结果需要融入该分支的历史年表输出中。",
  inputSchema: ActivateSystemSchema,
  async execute(input, { experimental_context }) {
    const { db, chatId } = experimental_context as ToolContext;
    const storyData = await db.query.story.findFirst({
      where: { chatId: chatId },
    });
    if (storyData?.system) {
      const { system: systemAgent } = await import("../index");
      const result = await systemAgent.generate({
        prompt: `## 金手指设定\n${storyData.system}\n\n## 当前剧情状态\n${input.currentSituation}\n\n## 触发原因\n${input.trigger}\n\n请根据以上情境进行介入。`,
        experimental_context,
      });
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
      prompt: `## 世界观设定\n${input.worldview}\n\n## 用户需求\n${input.userRequirement}\n\n请根据以上信息生成完整的金手指设定，完成后调用 saveSystemSetting 工具保存。`,
      experimental_context,
    });
    return result.text;
  },
});

export const agentTools = {
  activateSystem,
  exMachina,
} as const;
