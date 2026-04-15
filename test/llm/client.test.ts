import path from "path";
import { sleep } from "bun";
import { describe, test, expect } from "bun:test";
import { AIClient, loadConfig } from "@/lib/llm";

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

  test("Agent generate with tool call loop", async () => {
    const result = await client.generate("Titler", "Hello, test!");

    expect(result).toBeDefined();
    expect(result.text).toBe("Tool Call Success!");
  });
});
