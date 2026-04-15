import { ToolContext } from "@/lib/llm/type";
import { tool } from "ai";
import { z } from "zod";
import { sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const updateSessionTitle = tool({
  description: "update Session Title",
  inputSchema: z.object({
    title: z.string(),
  }),
  // location below is inferred to be a string:
  execute: async ({ title }, context) => {
    const { db, sessionId } = context.experimental_context as ToolContext;
    try {
      const result = await db
        .update(sessions)
        .set({
          title: title,
        })
        .where(eq(sessions.id, sessionId))
        .returning();
      if (result.length > 0) {
        return "Update Success!";
      } else {
        return `Update Fail: This record does not exist.`;
      }
    } catch (e) {
      return `Update Fail: ${e}`;
    }
  },
});
