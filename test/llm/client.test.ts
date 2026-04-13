import { describe, it, expect } from "bun:test";
import { AIClient } from "../../lib/llm";

const configPath = "./planb.test.yml";
const client = new AIClient(configPath);

describe("AIClient", () => {
  it("should read and parse valid planb.yml config correctly", () => {
    expect(client).toBeDefined();
    expect(client.primaryModel).toBe("mock/test");
  });

  it("should be list models", () => {
    expect(client.modles).toBeArray();
    expect(client.modles).toContain("mock/test");
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
