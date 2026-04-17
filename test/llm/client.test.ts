import { afterEach,beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import { db as testdb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { ArbiterAgent, provider,TitlerAgent } from "@/lib/llm";

describe("Base Test", async () => {
  test("should be list models", () => {
    const models = provider.models();
    expect(models).toBeArray();
    expect(models).toContain("mock/test");
  });

  test("should call agent generate successfully", async () => {
    const result = await ArbiterAgent.generate({
      prompt: "Hello, test!",
    });

    expect(result).toBeDefined();
    expect(result.text).toBe("Hello, world!");
  });
});

describe("Tool Call Test", async () => {
  beforeEach(() => {
    migrate(testdb, { migrationsFolder: "./drizzle" });
  });
  afterEach(async () => {
    await testdb.delete(schema.messages);
    await testdb.delete(schema.sessions);
    await testdb.delete(schema.users);
  });

  test("Success: Agent generate with tool call loop", async () => {
    const sessionId = "session-m1";

    await testdb.insert(schema.users).values({
      id: "user-m1",
      email: "message@example.com",
      name: "Message User",
    });

    await testdb.insert(schema.sessions).values({
      id: sessionId,
      userId: "user-m1",
      title: "Message Session",
    });

    const result = await TitlerAgent.generate({
      prompt: "Hello, test!",
      experimental_context: { db: testdb, sessionId: sessionId },
    });

    expect(result).toBeDefined();
    expect(result.toolResults[0].output).toBe("Update Success!");

    const [session] = await testdb
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId))
      .limit(1);

    expect(session).toBeDefined();
    expect(session?.title).toBe("Mock Title");
  });

  test("Fail: Agent generate with tool call loop", async () => {
    const sessionId = "session-m2";

    const result = await TitlerAgent.generate({
      prompt: "Hello, test!",
      experimental_context: { db: testdb, sessionId: sessionId },
    });

    expect(result).toBeDefined();
    expect(result.toolResults[0].output).toBe(
      "Update Fail: This record does not exist.",
    );
  });
});
