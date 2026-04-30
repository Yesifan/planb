import { StreamableValue } from "@ai-sdk/rsc";
import { UIMessageChunk } from "ai";
import { describe, expect, test } from "bun:test";
import { nanoid } from "nanoid";

import { streamToUIMessage } from "@/lib/llm/client";
import { MyUIMessage } from "@/lib/llm/type";

function createTestStream(
  chunks: UIMessageChunk[],
): StreamableValue<UIMessageChunk> {
  const STREAMABLE_VALUE_TYPE = Symbol.for("ui.streamable.value");

  const createChunk = (index: number): Record<string, unknown> => {
    if (index >= chunks.length) {
      return { curr: undefined };
    }
    const chunk: Record<string, unknown> = { curr: chunks[index] };
    if (index < chunks.length - 1) {
      chunk.next = Promise.resolve(createChunk(index + 1));
    }
    return chunk;
  };

  const stream = createChunk(0);
  stream.type = STREAMABLE_VALUE_TYPE;
  return stream as StreamableValue<UIMessageChunk>;
}

function getTextPart(
  parts: MyUIMessage["parts"],
  index: number,
): Extract<MyUIMessage["parts"][number], { type: "text" }> {
  return parts[index] as Extract<
    MyUIMessage["parts"][number],
    { type: "text" }
  >;
}

/** 消费 generator 到最后，返回最终 message */
async function collectFinal(
  gen: AsyncGenerator<MyUIMessage, MyUIMessage>,
): Promise<MyUIMessage> {
  let result: MyUIMessage | undefined;
  for await (const msg of gen) {
    result = msg;
  }
  return result ?? (await gen.return(undefined as never)).value;
}

describe("streamToUIMessage", () => {
  test("#given text stream chunks #when assembled #then produces text part with done state", async () => {
    const messageId = nanoid();
    const chunks: UIMessageChunk[] = [
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", delta: "Hello" },
      { type: "text-delta", id: "t1", delta: " World" },
      { type: "text-end", id: "t1" },
    ];

    const result = await collectFinal(
      streamToUIMessage(messageId, createTestStream(chunks)),
    );

    expect(result.parts.length).toBe(1);
    expect(result.parts[0].type).toBe("text");
    expect(getTextPart(result.parts, 0).text).toBe("Hello World");
    expect(getTextPart(result.parts, 0).state).toBe("done");
  });

  test("#given tool input stream chunks #when assembled #then produces tool part with input-available state", async () => {
    const messageId = nanoid();
    const chunks: UIMessageChunk[] = [
      {
        type: "tool-input-start",
        toolCallId: "tc1",
        toolName: "createStory",
      },
      {
        type: "tool-input-delta",
        toolCallId: "tc1",
        inputTextDelta: '{"title"',
      },
      {
        type: "tool-input-delta",
        toolCallId: "tc1",
        inputTextDelta: ':"My Story"}',
      },
      {
        type: "tool-input-available",
        toolCallId: "tc1",
        toolName: "createStory",
        input: { title: "My Story" },
      },
    ];

    const result = await collectFinal(
      streamToUIMessage(messageId, createTestStream(chunks)),
    );

    expect(result.parts.length).toBe(1);
    const toolPart = result.parts[0] as Record<string, unknown>;
    expect(toolPart.type).toBe("tool-createStory");
    expect(toolPart.toolCallId).toBe("tc1");
    expect(toolPart.state).toBe("input-available");
    expect(toolPart.input).toEqual({ title: "My Story" });
  });

  test("#given tool output available chunk #when assembled #then updates tool part to output-available", async () => {
    const messageId = nanoid();
    const chunks: UIMessageChunk[] = [
      {
        type: "tool-input-start",
        toolCallId: "tc1",
        toolName: "createStory",
      },
      {
        type: "tool-input-available",
        toolCallId: "tc1",
        toolName: "createStory",
        input: { title: "My Story" },
      },
      {
        type: "tool-output-available",
        toolCallId: "tc1",
        output: { success: true, storyId: "123" },
      },
    ];

    const result = await collectFinal(
      streamToUIMessage(messageId, createTestStream(chunks)),
    );

    expect(result.parts.length).toBe(1);
    const toolPart = result.parts[0] as Record<string, unknown>;
    expect(toolPart.state).toBe("output-available");
    expect(toolPart.output).toEqual({ success: true, storyId: "123" });
  });

  test("#given start chunk with messageId #when assembled #then sets message id", async () => {
    const messageId = nanoid();
    const chunks: UIMessageChunk[] = [
      { type: "start", messageId: "msg-123" },
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", delta: "Hello" },
      { type: "text-end", id: "t1" },
    ];

    const result = await collectFinal(
      streamToUIMessage(messageId, createTestStream(chunks)),
    );

    expect(result.id).toBe("msg-123");
  });

  test("#given multiple steps #when assembled #then parts accumulate across steps", async () => {
    const messageId = nanoid();
    const chunks: UIMessageChunk[] = [
      { type: "start-step" },
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", delta: "First" },
      { type: "text-end", id: "t1" },
      { type: "finish-step" },
      { type: "start-step" },
      { type: "text-start", id: "t2" },
      { type: "text-delta", id: "t2", delta: "Second" },
      { type: "text-end", id: "t2" },
    ];

    const result = await collectFinal(
      streamToUIMessage(messageId, createTestStream(chunks)),
    );

    const textParts = result.parts.filter((p) => p.type === "text");
    expect(textParts.length).toBe(2);
    expect(getTextPart(result.parts, 0).text).toBe("First");
    expect(getTextPart(result.parts, 1).text).toBe("Second");
  });

  test("#given streaming chunks #when iterated #then yields intermediate message states", async () => {
    const messageId = nanoid();
    const chunks: UIMessageChunk[] = [
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", delta: "Hi" },
      { type: "text-end", id: "t1" },
    ];

    const yielded: MyUIMessage[] = [];
    for await (const msg of streamToUIMessage(
      messageId,
      createTestStream(chunks),
    )) {
      yielded.push(msg);
    }

    expect(yielded.length).toBe(3);
    expect(getTextPart(yielded[0].parts, 0).state).toBe("streaming");
    expect(getTextPart(yielded[0].parts, 0).text).toBe("");
    expect(getTextPart(yielded[1].parts, 0).text).toBe("Hi");
    expect(getTextPart(yielded[2].parts, 0).state).toBe("done");
  });
});
