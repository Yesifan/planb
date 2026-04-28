import { describe, expect, it, mock } from "bun:test";

import { db } from "@/lib/db";
import { chat, message, story } from "@/lib/db/schema";

mock.module("@/lib/auth/server", () => ({
  getSessionWithRedirect: async () => ({
    user: {
      id: "test-user",
    },
  }),
}));

describe("getChatWithStory", () => {
  it("should throw for non-existent chatId", async () => {
    const { getChatWithStory } = await import("@/lib/actions/db");
    expect(getChatWithStory("non-existent-id")).rejects.toThrow();
  });

  it("should return chat and story data for valid chatId", async () => {
    const { getChatWithStory } = await import("@/lib/actions/db");
    const now = new Date();
    await db.insert(chat).values({
      id: "gcs-test-1",
      userId: "test-user",
      title: "Test Chat",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(story).values({
      id: "gcs-story-1",
      chatId: "gcs-test-1",
      source: "三国演义",
      singularity: "如果诸葛亮没有病死五丈原",
      type: "历史改编",
      describe: "一个关于蜀汉延续的故事",
      worldview: "架空三国",
      createdAt: now,
      updatedAt: now,
    });

    const result = await getChatWithStory("gcs-test-1");
    expect(result).not.toBeNull();
    expect(result.title).toBe("Test Chat");
    expect(result?.story?.source).toBe("三国演义");
    expect(result?.story?.type).toBe("历史改编");
  });

  it("should return chat with null story when chat exists but story does not", async () => {
    const { getChatWithStory } = await import("@/lib/actions/db");
    const now = new Date();
    await db.insert(chat).values({
      id: "gcs-chat-only",
      userId: "test-user",
      title: "No Story",
      createdAt: now,
      updatedAt: now,
    });

    const result = await getChatWithStory("gcs-chat-only");
    expect(result).not.toBeNull();
    expect(result.title).toBe("No Story");
    expect(result.story).toBeNull();
  });
});

describe("getChatMessages", () => {
  it("should return empty array for chat with no messages", async () => {
    const { getChatMessages } = await import("@/lib/actions/db");
    const now = new Date();
    await db.insert(chat).values({
      id: "gcm-empty-chat",
      userId: "test-user",
      title: "Empty Chat",
      createdAt: now,
      updatedAt: now,
    });

    const result = await getChatMessages("gcm-empty-chat");
    expect(result).toHaveLength(0);
  });

  it("should return messages ordered by createdAt desc (newest first)", async () => {
    const { getChatMessages } = await import("@/lib/actions/db");
    const now = new Date();
    await db.insert(chat).values({
      id: "gcm-msg-chat",
      userId: "test-user",
      title: "Message Chat",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(message).values({
      id: "gcm-msg-1",
      chatId: "gcm-msg-chat",
      role: "user",
      text: "Hello",
      createdAt: new Date(now.getTime() - 2000),
    });
    await db.insert(message).values({
      id: "gcm-msg-2",
      chatId: "gcm-msg-chat",
      role: "assistant",
      text: "Hi there",
      createdAt: new Date(now.getTime() - 1000),
    });

    const result = await getChatMessages("gcm-msg-chat");
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Hi there");
    expect(result[1].text).toBe("Hello");
  });
});
