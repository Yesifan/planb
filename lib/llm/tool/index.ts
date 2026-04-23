import { tool } from "ai";
import z from "zod";

import { createStory } from "./story";

const createQuestionSchema = z.array(
  z.object({
    question: z.string().describe("向用户提出的具体问题，应该清晰明确"),
    describe: z
      .string()
      .describe("问题的补充说明或提示，帮助用户理解需要提供什么信息")
      .optional(),
  }),
);

const createQuestion = tool({
  description:
    "当需要用户提供更多信息才能继续时，使用本工具向用户提问。可以一次性提出多个问题，引导用户进行格式化的信息输入。",
  inputSchema: createQuestionSchema,
});

const Tools = { createStory, createQuestion } as const;

type ToolKey = keyof typeof Tools;

export const ToolNames = Object.keys(Tools).reduce(
  (acc, key) => {
    const k = key as never;
    acc[k] = k;
    return acc;
  },
  {} as { [K in ToolKey]: K }, // 🌟 优化：保留严格的字面量类型
);
export default Tools;
