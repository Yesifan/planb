"use server";
import { createStreamableValue } from "@ai-sdk/rsc";

import { db } from "@/lib/db";
import { ArchivistAgent } from "@/lib/llm";

interface AgentContext {
  chatId: string;
}

export async function continueConversation(
  prompt: string,
  { chatId }: AgentContext,
) {
  // const history = await db.query.messages.findMany({
  //   where: {
  //     chatId: chatId,
  //     NOT: {
  //       role: "tool",
  //     },
  //   },
  //   orderBy: {
  //     createdAt: "desc",
  //   },
  //   limit: 10,
  // });

  // const messages = history.reverse().map((message) => ({
  //   role: message.role,
  //   content: message.content,
  // })) as ModelMessage[];

  const stream = createStreamableValue();

  (async () => {
    const { textStream } = await ArchivistAgent.stream({
      messages: [
        // ...messages,
        {
          role: "user",
          content: prompt,
        },
      ],
      experimental_context: { db, chatId: chatId },
    });

    for await (const text of textStream) {
      stream.update(text);
    }

    stream.done();
  })();

  return stream.value;
}
