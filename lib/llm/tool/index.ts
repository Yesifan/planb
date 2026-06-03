import { tool, ToolSet } from "ai";
import z from "zod";

import { createStory, saveSystemSetting } from "./story";

export const dice = tool({
  description:
    "扔骰子。1个16面骰子取最大点数，返回1-16的结果。调用时必须在 reason 中写清：检定目标、主角具体行动、为什么有不确定性、失败后果、预估难度/DC、影响判定的准备/资源/环境。",
  inputSchema: z.object({
    reason: z
      .string()
      .describe(
        "本次检定的完整上下文。必须包含：目标=主角想改变什么；行动=主角具体做法；风险=为何可能失败及失败后果；难度=参考DC或难度等级；修正因素=主角能力、准备、工具、环境、敌方警觉等。示例：'目标：无声进入档案室并取得名单；行动：夜间潜入并撬锁；风险：巡逻密集，失败会触发警戒；难度：DC 10 困难；修正因素：有平面图但没有钥匙。'",
      ),
  }),
  async execute() {
    return Math.floor(Math.random() * 16) + 1;
  },
});

const createQuestionSchema = z.object({
  title: z.string().describe("给你的提问起一个标题"),
  describe: z.string().describe("详细说明询问的原因和前因后果").optional(),
  questions: z.array(
    z.object({
      question: z.string().describe("简短的描述问题"),
      describe: z
        .string()
        .describe(
          "问题的补充说明，提示已经前应后果，帮助用户理解需要提供什么信息",
        )
        .optional(),
    }),
  ),
});

const createQuestion = tool({
  description:
    "当需要用户提供更多信息才能继续时，使用本工具向用户提问。可以一次性提出多个问题，引导用户进行格式化的信息输入。",
  inputSchema: createQuestionSchema,
});
export type CreateQuestion = z.infer<typeof createQuestionSchema>;

const judgeInput = tool({
  description:
    "用户输入审查工具：必须为每一次用户输入调用本工具一次，给出 approve（放行）或 reject（拒绝）的明确判定。approve 时在 content 中输出标准化的历史年表；reject 时在 content 中说明拒绝原因。",
  inputSchema: z.object({
    decision: z
      .enum(["approve", "reject"])
      .describe(
        "审查结论：approve 表示输入合理放行；reject 表示输入违反世界设定/严重 OOC/为空乱码等需要用户重新输入",
      ),
    content: z
      .string()
      .describe(
        "approve 时填写转化后的历史年表文本（供下游 Agent 消费）；reject 时填写清晰的拒绝原因（用于提示用户重新输入）",
      ),
  }),
});

const Tools = {
  createStory,
  createQuestion,
  dice,
  judgeInput,
  saveSystemSetting,
} satisfies ToolSet;

export default Tools;

export const AgentTookKeys = ["activateSystem", "exMachina", "reviewBranch"];

export const ToolKeys = [
  "createStory",
  "createQuestion",
  "dice",
  "judgeInput",
  "saveSystemSetting",
] as const;

export const AllToolKeys = [...ToolKeys, ...AgentTookKeys] as const;

export type MyTools = typeof Tools;
