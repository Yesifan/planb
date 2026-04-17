import { describe, expect,test } from "bun:test";
import { desc,eq } from "drizzle-orm";

import { db as testdb } from "@/lib/db";
import * as schema from "@/lib/db/schema";

describe("Database CRUD Operations", () => {
  describe("Users", () => {
    test("read user by id", async () => {
      await testdb.insert(schema.users).values({
        id: "user-2",
        email: "read@example.com",
        name: "Read User",
      });

      const result = await testdb
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, "user-2"));

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("read@example.com");
      expect(result[0].name).toBe("Read User");
    });

    test("update user", async () => {
      await testdb.insert(schema.users).values({
        id: "user-3",
        email: "update@example.com",
        name: "Old Name",
      });

      const result = await testdb
        .update(schema.users)
        .set({ name: "New Name" })
        .where(eq(schema.users.id, "user-3"))
        .returning();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("New Name");
    });

    test("delete user", async () => {
      await testdb.insert(schema.users).values({
        id: "user-4",
        email: "delete@example.com",
        name: "Delete User",
      });

      await testdb.delete(schema.users).where(eq(schema.users.id, "user-4"));

      const result = await testdb
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, "user-4"));

      expect(result).toHaveLength(0);
    });
  });

  describe("Sessions", () => {
    test("create session", async () => {
      await testdb.insert(schema.users).values({
        id: "user-s1",
        email: "session@example.com",
        name: "Session User",
      });

      const result = await testdb
        .insert(schema.sessions)
        .values({
          id: "session-1",
          userId: "user-s1",
          title: "Test Session",
        })
        .returning();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("session-1");
      expect(result[0].title).toBe("Test Session");
    });

    test("read sessions by user", async () => {
      await testdb.insert(schema.users).values({
        id: "user-s2",
        email: "sessions@example.com",
        name: "Sessions User",
      });

      await testdb.insert(schema.sessions).values({
        id: "session-2a",
        userId: "user-s2",
        title: "First Session",
      });

      await testdb.insert(schema.sessions).values({
        id: "session-2b",
        userId: "user-s2",
        title: "Second Session",
      });

      const result = await testdb
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.userId, "user-s2"))
        .orderBy(desc(schema.sessions.createdAt));

      expect(result).toHaveLength(2);
    });

    test("update session title", async () => {
      await testdb.insert(schema.users).values({
        id: "user-s3",
        email: "update-session@example.com",
        name: "Update User",
      });

      await testdb.insert(schema.sessions).values({
        id: "session-3",
        userId: "user-s3",
        title: "Old Title",
      });

      const result = await testdb
        .update(schema.sessions)
        .set({ title: "New Title" })
        .where(eq(schema.sessions.id, "session-3"))
        .returning();

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("New Title");
    });

    test("delete session with cascade", async () => {
      await testdb.insert(schema.users).values({
        id: "user-s4",
        email: "delete-session@example.com",
        name: "Delete Session User",
      });

      await testdb.insert(schema.sessions).values({
        id: "session-4",
        userId: "user-s4",
        title: "To Delete",
      });

      await testdb
        .delete(schema.sessions)
        .where(eq(schema.sessions.id, "session-4"));

      const result = await testdb
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.id, "session-4"));

      expect(result).toHaveLength(0);
    });
  });

  describe("Messages", () => {
    test("create message", async () => {
      await testdb.insert(schema.users).values({
        id: "user-m1",
        email: "message@example.com",
        name: "Message User",
      });

      await testdb.insert(schema.sessions).values({
        id: "session-m1",
        userId: "user-m1",
        title: "Message Session",
      });

      const result = await testdb
        .insert(schema.messages)
        .values({
          id: "msg-1",
          sessionId: "session-m1",
          role: "user",
          content: "Hello, this is a test message",
        })
        .returning();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("msg-1");
      expect(result[0].role).toBe("user");
      expect(result[0].content).toBe("Hello, this is a test message");
    });

    test("read messages by session", async () => {
      await testdb.insert(schema.users).values({
        id: "user-m2",
        email: "messages@example.com",
        name: "Messages User",
      });

      await testdb.insert(schema.sessions).values({
        id: "session-m2",
        userId: "user-m2",
        title: "Messages Session",
      });

      await testdb.insert(schema.messages).values({
        id: "msg-2a",
        sessionId: "session-m2",
        role: "user",
        content: "First message",
      });

      await testdb.insert(schema.messages).values({
        id: "msg-2b",
        sessionId: "session-m2",
        role: "assistant",
        content: "Response to first message",
      });

      const result = await testdb
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.sessionId, "session-m2"))
        .orderBy(schema.messages.createdAt);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe("user");
      expect(result[1].role).toBe("assistant");
    });

    test("update message", async () => {
      await testdb.insert(schema.users).values({
        id: "user-m3",
        email: "update-msg@example.com",
        name: "Update Message User",
      });

      await testdb.insert(schema.sessions).values({
        id: "session-m3",
        userId: "user-m3",
        title: "Update Message Session",
      });

      await testdb.insert(schema.messages).values({
        id: "msg-3",
        sessionId: "session-m3",
        role: "user",
        content: "Original content",
      });

      const result = await testdb
        .update(schema.messages)
        .set({ content: "Updated content" })
        .where(eq(schema.messages.id, "msg-3"))
        .returning();

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("Updated content");
    });

    test("delete message", async () => {
      await testdb.insert(schema.users).values({
        id: "user-m4",
        email: "delete-msg@example.com",
        name: "Delete Message User",
      });

      await testdb.insert(schema.sessions).values({
        id: "session-m4",
        userId: "user-m4",
        title: "Delete Message Session",
      });

      await testdb.insert(schema.messages).values({
        id: "msg-4",
        sessionId: "session-m4",
        role: "user",
        content: "Message to delete",
      });

      await testdb
        .delete(schema.messages)
        .where(eq(schema.messages.id, "msg-4"));

      const result = await testdb
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.id, "msg-4"));

      expect(result).toHaveLength(0);
    });
  });
});
