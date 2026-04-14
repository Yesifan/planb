import path from "path";
import { describe, it, expect } from "bun:test";
import { AIClient, loadConfig } from "@/lib/llm";

const configPath = path.resolve(__dirname, "../../planb.test.yml");
const llmConfig = loadConfig(configPath);
const client = new AIClient(llmConfig);

describe("AIClient", () => {
  it("should read and parse valid planb.yml config correctly", () => {
    expect(client).toBeDefined();
    expect(client.primaryModel).toBe("mock/test");
  });

  it("should be list models", () => {
    expect(client.models).toBeArray();
    expect(client.models).toContain("mock/test");
  });

  it("should call generateText successfully", async () => {
    const result = await client.generateText({
      model: "mock/test",
      prompt: "Hello, test!",
    });

    expect(result).toBeDefined();
    expect(result.text).toBe("Hello, world!");
  });
});
