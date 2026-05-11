import { tool, ToolSet } from "ai";
import z from "zod";

import { createStory, saveSystemSetting } from "./story";

export const dice = tool({
  description: "扔骰子。3个16面骰子取最大点数，返回1-16的结果。",
  inputSchema: z.object({}),
  async execute() {
    const roll = () => Math.floor(Math.random() * 16) + 1;
    const max = Math.max(roll(), roll(), roll());

    return { max };
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

const rejectInput = tool({
  description:
    "当用户输入在当前世界设定下不合理、违反逻辑或严重 OOC 时，使用本工具拒绝该输入并向用户说明原因。用户需要重新输入。",
  inputSchema: z.object({
    reason: z
      .string()
      .describe(
        "拒绝原因：清晰说明为什么该输入在当前世界设定下不合理，帮助用户理解并重新输入",
      ),
  }),
});

const Tools = {
  createStory,
  createQuestion,
  dice,
  rejectInput,
  saveSystemSetting,
} satisfies ToolSet;

export default Tools;

export const AgentTookKeys = ["activateSystem", "exMachina"];

export const ToolKeys = [
  "createStory",
  "createQuestion",
  "dice",
  "rejectInput",
  "saveSystemSetting",
] as const;

export const AllToolKeys = [...ToolKeys, ...AgentTookKeys] as const;

export type MyTools = typeof Tools;
