import {
  LanguageModelV3Content,
  LanguageModelV3StreamPart,
} from "@ai-sdk/provider";
import { LanguageModel, simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";

import { MockProvider } from "./type";

export type MockUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type MockTextResponse = {
  kind: "text";
  text: string;
  usage: MockUsage;
};

export type MockToolCallResponse = {
  kind: "tool-call";
  toolName: string;
  input: object;
  text?: string;
  usage: MockUsage;
};
export type MockInvalidToolCallResponse = {
  kind: "invalid-tool-call";
  toolName: string;
  inputJson: string;
  text?: string;
  usage: MockUsage;
};

export type MockResponse =
  | MockTextResponse
  | MockToolCallResponse
  | MockInvalidToolCallResponse;

let mockQueue: MockResponse[] = [];
let toolCallCounter = 0;
let mockCallOptions: unknown[] = [];

export function setMockResponses(responses: MockResponse[]) {
  mockQueue = [...responses];
}

export function resetMock() {
  mockQueue = [];
  mockCallOptions = [];
}

export function remainingMockResponses(): number {
  return mockQueue.length;
}

export function getMockCallOptions(): readonly unknown[] {
  return mockCallOptions;
}

function shiftResponse(): MockResponse | undefined {
  return mockQueue.shift();
}

function toV3Usage(u: MockUsage) {
  return {
    inputTokens: {
      total: u.inputTokens,
      noCache: u.inputTokens,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: u.outputTokens,
      text: u.outputTokens,
      reasoning: undefined,
    },
  };
}

function textStreamChunks(
  text: string,
  usage: MockUsage,
): LanguageModelV3StreamPart[] {
  return [
    { type: "text-start" as const, id: "t1" },
    { type: "text-delta" as const, id: "t1", delta: text },
    { type: "text-end" as const, id: "t1" },
    {
      type: "finish" as const,
      finishReason: { unified: "stop" as const, raw: undefined },
      usage: toV3Usage(usage),
    },
  ];
}

function toolCallStreamChunks(
  toolName: string,
  inputJson: string,
  usage: MockUsage,
  text?: string,
): LanguageModelV3StreamPart[] {
  const toolCallId = `${toolName}_MOCK_${toolCallCounter++}`;
  const chunks: LanguageModelV3StreamPart[] = text
    ? [
        { type: "text-start", id: "t1" },
        { type: "text-delta", id: "t1", delta: text },
        { type: "text-end", id: "t1" },
      ]
    : [];

  return [
    ...chunks,
    { type: "tool-input-start", id: toolCallId, toolName },
    { type: "tool-input-delta", id: toolCallId, delta: inputJson },
    { type: "tool-input-end", id: toolCallId },
    { type: "tool-call", toolCallId, toolName, input: inputJson },
    {
      type: "finish",
      finishReason: { unified: "tool-calls", raw: undefined },
      usage: toV3Usage(usage),
    },
  ];
}

function textGenerateContent(text: string): LanguageModelV3Content {
  return { type: "text", text };
}

function toolCallGenerateContent(
  toolName: string,
  inputJson: string,
): LanguageModelV3Content {
  return {
    type: "tool-call",
    toolCallId: `${toolName}_MOCK_${toolCallCounter++}`,
    toolName,
    input: inputJson,
  };
}

function toolCallInputJson(response: MockToolCallResponse | MockInvalidToolCallResponse) {
  if (response.kind === "invalid-tool-call") {
    return response.inputJson;
  }
  return JSON.stringify(response.input);
}

const defaultUsage = toV3Usage({ inputTokens: 1, outputTokens: 1 });

// 官方文档 https://ai-sdk.dev/docs/ai-sdk-core/testing
export function createMockProvider<CHAT_MODEL_IDS extends LanguageModel>() {
  const defaultMock = new MockLanguageModelV3({
    doGenerate: async (options) => {
      mockCallOptions.push(options);
      const resp = shiftResponse();
      if (!resp) {
        return {
          content: [{ type: "text", text: "Hello, world!" }],
          finishReason: { unified: "stop", raw: undefined },
          usage: defaultUsage,
          warnings: [],
        };
      }
      const content =
        resp.kind === "text"
          ? [textGenerateContent(resp.text)]
          : [
              toolCallGenerateContent(
                resp.toolName,
                toolCallInputJson(resp),
              ),
            ];

      return {
        content,
        finishReason:
          resp.kind !== "text"
            ? { unified: "tool-calls", raw: undefined }
            : { unified: "stop", raw: undefined },
        usage: toV3Usage(resp.usage),
        warnings: [],
      };
    },
    doStream: async (options) => {
      mockCallOptions.push(options);
      const resp = shiftResponse();
      if (!resp) {
        return {
          stream: simulateReadableStream({
            chunks: textStreamChunks("Hello, world!", {
              inputTokens: 1,
              outputTokens: 1,
            }),
          }),
        };
      }
      const chunks =
        resp.kind === "text"
          ? textStreamChunks(resp.text, resp.usage)
          : toolCallStreamChunks(
              resp.toolName,
              toolCallInputJson(resp),
              resp.usage,
              resp.text,
            );

      return {
        stream: simulateReadableStream({ chunks }),
      };
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const provider = (_modelId: CHAT_MODEL_IDS) => {
    return defaultMock;
  };

  return provider as MockProvider;
}
