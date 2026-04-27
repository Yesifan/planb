import { tool } from "ai";
import z from "zod";

import { createStory } from "./story";

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
export type CreateQuestion = z.infer<typeof createQuestionSchema>;
export default Tools;
