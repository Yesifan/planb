import { describe, expect, test } from "bun:test";

import { estimateModelMessageTokens } from "./token";

describe("estimateModelMessageTokens", () => {
  test("should count string and cjk content with deterministic weights", () => {
    expect(
      estimateModelMessageTokens([
        { role: "user", content: "abcd 三国" },
        undefined,
      ]),
    ).toBe(4);
  });

  test("should count model message parts and serialized tool payloads", () => {
    expect(
      estimateModelMessageTokens([
        {
          role: "assistant",
          content: [
            { type: "text", text: "abcdefgh" },
            {
              type: "tool-call",
              toolCallId: "tc1",
              toolName: "dice",
              input: { content: "九州" },
            },
          ],
        },
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "tc1",
              toolName: "dice",
              output: { type: "text", value: "ok" },
            },
          ],
        },
      ]),
    ).toBe(21);
  });
});
