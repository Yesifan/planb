import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import { db as testdb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { ArbiterAgent, provider, TitlerAgent } from "@/lib/llm";

describe("Base Test", () => {
  test("should be list models", () => {
    const models = provider.models();
    expect(models).toBeArray();
    expect(models).toContain("mock/test");
  });

  test("should have registered agents correctly", () => {
    expect(ArbiterAgent).toBeDefined();
    expect(TitlerAgent).toBeDefined();
  });
});

describe("Tool Call Test", () => {
  beforeEach(() => {
    migrate(testdb, { migrationsFolder: "./drizzle" });
  });
  afterEach(async () => {
    await testdb.delete(schema.messages);
    await testdb.delete(schema.chat);
  });

  test("Success: Agent generate with tool call loop", async () => {
    const sessionId = "chat-m1";

    await testdb.insert(schema.chat).values({
      id: sessionId,
      userId: "user-m1",
      title: "Message Session",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await TitlerAgent.generate({
      prompt: "Hello, test!",
      experimental_context: { db: testdb, sessionId: sessionId },
    });

    expect(result).toBeDefined();

    const [chat] = await testdb
      .select()
      .from(schema.chat)
      .where(eq(schema.chat.id, sessionId))
      .limit(1);

    expect(chat).toBeDefined();
    expect(chat?.title).toBeDefined();
  });

  test("Fail: Agent generate with tool call loop", async () => {
    const sessionId = "chat-m2";

    const result = await TitlerAgent.generate({
      prompt: "Hello, test!",
      experimental_context: { db: testdb, sessionId: sessionId },
    });

    expect(result).toBeDefined();
    expect(result.toolResults?.[0]?.output).toContain("Update Fail");
  });
});
