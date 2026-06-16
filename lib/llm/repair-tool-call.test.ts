import { tool } from "ai";
import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { createRepairToolCall } from "./repair-tool-call";

describe("createRepairToolCall", () => {
  test("should return null when tool is not found in tool set", async () => {
    const mockModel = {} as Parameters<typeof createRepairToolCall>[0];
    const repair = createRepairToolCall(mockModel);

    const result = await repair({
      system: undefined,
      messages: [],
      toolCall: {
        type: "tool-call",
        toolCallId: "test-1",
        toolName: "nonExistentTool",
        input: "{ invalid json",
      },
      tools: {
        someOtherTool: tool({
          description: "test",
          inputSchema: z.object({}),
        }),
      },
      inputSchema: async () => ({ type: "object" as const }),
      error: new Error("test error"),
    });

    expect(result).toBeNull();
  });

  test("should return null when repair generateText call fails", async () => {
    // Use a mock model that will cause generateText to fail
    const mockModel = {} as Parameters<typeof createRepairToolCall>[0];
    const repair = createRepairToolCall(mockModel);

    const testTool = tool({
      description: "test tool",
      inputSchema: z.object({ name: z.string() }),
    });

    const result = await repair({
      system: undefined,
      messages: [],
      toolCall: {
        type: "tool-call",
        toolCallId: "test-2",
        toolName: "testTool",
        input: "{ invalid json",
      },
      tools: { testTool },
      inputSchema: async () => ({
        type: "object" as const,
        properties: { name: { type: "string" } },
      }),
      error: new Error("AI_InvalidToolInputError"),
    });

    // Should return null because generateText fails with invalid model
    expect(result).toBeNull();
  });
});
