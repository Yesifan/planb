import path from "path";
import { sleep } from "bun";
import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  afterAll,
} from "bun:test";
import { AIClient, loadConfig } from "@/lib/llm";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { eq, desc } from "drizzle-orm";
import { db as testdb, closeDatabase } from "@/lib/db";
import * as schema from "@/lib/db/schema";

const configPath = path.resolve(__dirname, "../../planb.test.yml");
const llmConfig = loadConfig(configPath);
const client = new AIClient(llmConfig);

describe("AIClient", async () => {
  await sleep(100);

  test("should read and parse valid planb.yml config correctly", () => {
    expect(client).toBeDefined();
    expect(client.primaryModel).toBe("mock/test");
  });

  test("should be list models", () => {
    expect(client.models).toBeArray();
    expect(client.models).toContain("mock/test");
  });

  test("Agent list and find the 'Titler' Agent", async () => {
    expect(client.agents).toBeArray();
    expect(client.agents).toContain("Titler");
  });

  test("should call agent generate successfully", async () => {
    const result = await client.generate("Arbiter", "Hello, test!");

    expect(result).toBeDefined();
    expect(result.text).toBe("Hello, world!");
  });
});

describe("AIClient with DB", async () => {
  sleep(100);

  beforeEach(() => {
    migrate(testdb, { migrationsFolder: "./drizzle" });
  });
  afterEach(async () => {
    await testdb.delete(schema.messages);
    await testdb.delete(schema.sessions);
    await testdb.delete(schema.users);
  });

  afterAll(() => {
    closeDatabase();
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

    const result = await client.generate("Titler", "Hello, test!", {
      experimental_context: { db: testdb, sessionId: sessionId },
    });

    expect(result).toBeDefined();
    expect(result.toolResults[0].output).toBe("Update Success!");

    const session = await testdb.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    expect(session).toBeDefined();
    expect(session?.title).toBe("Mock Title");
  });

  test("Fail: Agent generate with tool call loop", async () => {
    const sessionId = "session-m2";

    const result = await client.generate("Titler", "Hello, test!", {
      experimental_context: { db: testdb, sessionId: sessionId },
    });

    expect(result).toBeDefined();
    expect(result.toolResults[0].output).toBe(
      "Update Fail: This record does not exist.",
    );
  });
});
