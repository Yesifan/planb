import { describe, expect, mock, test } from "bun:test";

import { db } from "@/lib/db";
import { chat, history, message, story } from "@/lib/db/schema";

mock.module("@/lib/auth/server", () => ({
  getSessionWithRedirect: async () => ({
    user: {
      id: "test-user",
    },
  }),
}));

describe("getChatTokens", () => {
  test("should return correct token sums for chat with multiple messages", async () => {
    const { getChatTokens } = await import("@/lib/actions/db");
    const now = new Date();
    await db.insert(chat).values({
      id: "gct-multi",
      userId: "test-user",
      title: "Multi Messages",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(message).values({
      id: "gct-multi-m1",
      chatId: "gct-multi",
      role: "assistant",
      text: "msg 1",
      inputTokens: 100,
      outputTokens: 50,
      createdAt: now,
    });
    await db.insert(message).values({
      id: "gct-multi-m2",
      chatId: "gct-multi",
      role: "assistant",
      text: "msg 2",
      inputTokens: 200,
      outputTokens: 75,
      createdAt: now,
    });
    await db.insert(message).values({
      id: "gct-multi-m3",
      chatId: "gct-multi",
      role: "user",
      text: "msg 3",
      inputTokens: null,
      outputTokens: null,
      createdAt: now,
    });

    const result = await getChatTokens("gct-multi");
    expect(result).toEqual({
      inputTokens: 300,
      outputTokens: 125,
      contextTokens: 2,
    });
  });

  test("should return zeros for chat with no messages", async () => {
    const { getChatTokens } = await import("@/lib/actions/db");
    const now = new Date();
    await db.insert(chat).values({
      id: "gct-empty",
      userId: "test-user",
      title: "Empty",
      createdAt: now,
      updatedAt: now,
    });

    const result = await getChatTokens("gct-empty");
    expect(result).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      contextTokens: 0,
    });
  });

  test("should exclude null token values from sum", async () => {
    const { getChatTokens } = await import("@/lib/actions/db");
    const now = new Date();
    await db.insert(chat).values({
      id: "gct-nulls",
      userId: "test-user",
      title: "With Nulls",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(message).values({
      id: "gct-nulls-m1",
      chatId: "gct-nulls",
      role: "user",
      text: "null tokens",
      inputTokens: null,
      outputTokens: null,
      createdAt: now,
    });
    await db.insert(message).values({
      id: "gct-nulls-m2",
      chatId: "gct-nulls",
      role: "assistant",
      text: "with tokens",
      inputTokens: 42,
      outputTokens: 17,
      createdAt: now,
    });

    const result = await getChatTokens("gct-nulls");
    expect(result).toEqual({
      inputTokens: 42,
      outputTokens: 17,
      contextTokens: 4,
    });
  });

  test("should include current story history and latest message in context tokens", async () => {
    const { getChatTokens } = await import("@/lib/actions/db");
    const now = new Date();
    await db.insert(chat).values({
      id: "gct-context",
      userId: "test-user",
      title: "Context",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(story).values({
      id: "gct-context-story",
      chatId: "gct-context",
      source: "三国",
      singularity: "孔明北伐",
      type: "历史",
      worldview: "九州",
      system: "无",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(history).values({
      id: "gct-context-history",
      chatId: "gct-context",
      content: "长安",
      createdAt: now,
    });
    await db.insert(message).values({
      id: "gct-context-message",
      chatId: "gct-context",
      role: "user",
      text: "继续",
      createdAt: now,
    });

    const result = await getChatTokens("gct-context");

    expect(result).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      contextTokens: 37,
    });
  });

  test("should throw for non-existent chat", async () => {
    const { getChatTokens } = await import("@/lib/actions/db");
    expect(getChatTokens("does-not-exist")).rejects.toThrow();
  });
});
