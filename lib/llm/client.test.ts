import { createStreamableValue } from "@ai-sdk/rsc";
import { UIMessageChunk } from "ai";
import { describe, expect, test } from "bun:test";

import { archivist, sentinel } from "@/lib/llm";
import { streamToUIMessage } from "@/lib/llm/client";
import { resetMock, setMockResponses } from "@/lib/llm/mock-provider";

import { AgentStatusEvent } from "./type";

describe("streamToUIMessage", () => {
  test("should assemble single text part marked done when archivist streams plain text", async () => {
    setMockResponses([
      {
        kind: "text",
        text: "Hello World",
        usage: { inputTokens: 10, outputTokens: 20 },
      },
    ]);

    const stream = createStreamableValue<UIMessageChunk | AgentStatusEvent>();
    const agentResult = await archivist.stream({ prompt: "say hi" });
    (async () => {
      for await (const chunk of agentResult.toUIMessageStream()) {
        stream.update(chunk);
      }
      stream.done();
    })();

    let final;
    let sawStreamingState = false;
    for await (const msg of streamToUIMessage("msg-1", stream.value)) {
      final = msg;
      if (
        msg.parts[0]?.type === "text" &&
        (msg.parts[0] as { state: string }).state === "streaming"
      ) {
        sawStreamingState = true;
      }
    }

    expect(final?.parts).toHaveLength(1);
    const textPart = final!.parts[0];
    expect(textPart.type).toBe("text");
    expect((textPart as { text: string }).text).toBe("Hello World");
    expect((textPart as { state: string }).state).toBe("done");
    expect(sawStreamingState).toBe(true);

    resetMock();
  });

  test("should assemble tool part with input-available state when sentinel calls judgeInput", async () => {
    setMockResponses([
      {
        kind: "tool-call",
        toolName: "judgeInput",
        input: { decision: "approve", content: "history line" },
        usage: { inputTokens: 5, outputTokens: 5 },
      },
    ]);

    const stream = createStreamableValue<UIMessageChunk | AgentStatusEvent>();
    const agentResult = await sentinel.stream({ prompt: "user input" });
    (async () => {
      for await (const chunk of agentResult.toUIMessageStream()) {
        stream.update(chunk);
      }
      stream.done();
    })();

    let final;
    for await (const msg of streamToUIMessage("msg-2", stream.value)) {
      final = msg;
    }

    const toolPart = final?.parts.find((p) => p.type === "tool-judgeInput");
    expect(toolPart).toBeDefined();
    expect((toolPart as { state: string }).state).toBe("input-available");
    expect((toolPart as { input: object }).input).toMatchObject({
      decision: "approve",
      content: "history line",
    });

    resetMock();
  });

  test("should keep fallback id and assistant role when agent emits no messageId", async () => {
    setMockResponses([
      {
        kind: "text",
        text: "x",
        usage: { inputTokens: 1, outputTokens: 1 },
      },
    ]);

    const stream = createStreamableValue<UIMessageChunk | AgentStatusEvent>();
    const agentResult = await archivist.stream({ prompt: "p" });
    (async () => {
      for await (const chunk of agentResult.toUIMessageStream()) {
        stream.update(chunk);
      }
      stream.done();
    })();

    let final;
    for await (const msg of streamToUIMessage("fallback-id", stream.value)) {
      final = msg;
    }

    expect(final?.id).toBe("fallback-id");
    expect(final?.role).toBe("assistant");

    resetMock();
  });
});
