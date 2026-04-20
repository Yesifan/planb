import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { db as testdb } from "@/lib/db";
import * as schema from "@/lib/db/schema";

describe("Database CRUD Operations", () => {
  describe("Chat", () => {
    test("create and read chat by id", async () => {
      await testdb.insert(schema.chat).values({
        id: "chat-2",
        userId: "user-2",
        title: "Test Chat",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await testdb
        .select()
        .from(schema.chat)
        .where(eq(schema.chat.id, "chat-2"));

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Test Chat");
      expect(result[0].userId).toBe("user-2");
    });

    test("update chat title", async () => {
      await testdb.insert(schema.chat).values({
        id: "chat-3",
        userId: "user-3",
        title: "Old Title",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await testdb
        .update(schema.chat)
        .set({ title: "New Title" })
        .where(eq(schema.chat.id, "chat-3"));

      const result = await testdb
        .select()
        .from(schema.chat)
        .where(eq(schema.chat.id, "chat-3"));

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("New Title");
    });

    test("delete chat", async () => {
      await testdb.insert(schema.chat).values({
        id: "chat-4",
        userId: "user-4",
        title: "Delete Me",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await testdb.delete(schema.chat).where(eq(schema.chat.id, "chat-4"));

      const result = await testdb
        .select()
        .from(schema.chat)
        .where(eq(schema.chat.id, "chat-4"));

      expect(result).toHaveLength(0);
    });
  });

  describe("Messages", () => {
    test("create and read message by chat", async () => {
      await testdb.insert(schema.chat).values({
        id: "chat-m1",
        userId: "user-1",
        title: "Message Test Chat",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await testdb.insert(schema.messages).values({
        id: "msg-1",
        chatId: "chat-m1",
        role: "user",
        content: "Hello World",
        createdAt: new Date(),
      });

      const result = await testdb
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.chatId, "chat-m1"));

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("Hello World");
      expect(result[0].role).toBe("user");
    });

    test("update message content", async () => {
      await testdb.insert(schema.chat).values({
        id: "chat-m2",
        userId: "user-2",
        title: "Update Test",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await testdb.insert(schema.messages).values({
        id: "msg-2",
        chatId: "chat-m2",
        role: "assistant",
        content: "Old content",
        createdAt: new Date(),
      });

      await testdb
        .update(schema.messages)
        .set({ content: "New content" })
        .where(eq(schema.messages.id, "msg-2"));

      const result = await testdb
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.id, "msg-2"));

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("New content");
    });

    test("delete message directly", async () => {
      await testdb.insert(schema.chat).values({
        id: "chat-m3",
        userId: "user-3",
        title: "Delete Message",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await testdb.insert(schema.messages).values({
        id: "msg-3",
        chatId: "chat-m3",
        role: "user",
        content: "To be deleted",
        createdAt: new Date(),
      });

      await testdb
        .delete(schema.messages)
        .where(eq(schema.messages.id, "msg-3"));

      const messagesResult = await testdb
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.id, "msg-3"));

      expect(messagesResult).toHaveLength(0);
    });
  });
});
