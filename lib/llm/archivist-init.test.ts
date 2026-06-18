import { describe, expect, test } from "bun:test";

import {
  isArchivistInitComplete,
  missingInitToolNames,
} from "./archivist-init";

describe("isArchivistInitComplete", () => {
  test("should return false when no steps have been executed", () => {
    expect(isArchivistInitComplete([])).toBe(false);
  });

  test("should return false when no required init tools have been called", () => {
    const steps = [
      {
        toolResults: [{ toolName: "someOtherTool", dynamic: false }],
        dynamicToolCalls: [],
      },
    ];
    expect(isArchivistInitComplete(steps)).toBe(false);
  });

  test("should return false when only some required init tools have been called", () => {
    const steps = [
      {
        toolResults: [{ toolName: "initializeProtagonistState", dynamic: false }],
        dynamicToolCalls: [],
      },
    ];
    expect(isArchivistInitComplete(steps)).toBe(false);
  });

  test("should return false when required tools have only dynamic (invalid) results", () => {
    const steps = [
      {
        toolResults: [
          { toolName: "initializeProtagonistState", dynamic: true },
          { toolName: "initializeTaskState", dynamic: true },
          { toolName: "createStory", dynamic: true },
        ],
        dynamicToolCalls: [],
      },
    ];
    expect(isArchivistInitComplete(steps)).toBe(false);
  });

  test("should return true when all required init tools have been successfully called", () => {
    const steps = [
      {
        toolResults: [
          { toolName: "initializeProtagonistState", dynamic: false },
          { toolName: "initializeTaskState", dynamic: false },
          { toolName: "createStory", dynamic: false },
        ],
        dynamicToolCalls: [],
      },
    ];
    expect(isArchivistInitComplete(steps)).toBe(true);
  });

  test("should return true when all required init tools are spread across multiple steps", () => {
    const steps = [
      {
        toolResults: [{ toolName: "initializeProtagonistState", dynamic: false }],
        dynamicToolCalls: [],
      },
      {
        toolResults: [
          { toolName: "initializeTaskState", dynamic: false },
          { toolName: "createStory", dynamic: false },
        ],
        dynamicToolCalls: [],
      },
    ];
    expect(isArchivistInitComplete(steps)).toBe(true);
  });

  test("should return true when required tools are mixed with other tools", () => {
    const steps = [
      {
        toolResults: [
          { toolName: "initializeProtagonistState", dynamic: false },
          { toolName: "someOtherTool", dynamic: false },
        ],
        dynamicToolCalls: [],
      },
      {
        toolResults: [
          { toolName: "initializeTaskState", dynamic: false },
          { toolName: "createStory", dynamic: false },
        ],
        dynamicToolCalls: [],
      },
    ];
    expect(isArchivistInitComplete(steps)).toBe(true);
  });
});

describe("missingInitToolNames", () => {
  test("should return all required tools when nothing has been completed", () => {
    const result = missingInitToolNames(new Set());
    expect(result).toEqual([
      "createStory",
      "initializeProtagonistState",
      "initializeTaskState",
    ]);
  });

  test("should return only missing tools when some are completed", () => {
    const result = missingInitToolNames(
      new Set(["initializeProtagonistState"]),
    );
    expect(result).toEqual(["createStory", "initializeTaskState"]);
  });

  test("should return empty array when all required tools are completed", () => {
    const result = missingInitToolNames(
      new Set([
        "createStory",
        "initializeProtagonistState",
        "initializeTaskState",
      ]),
    );
    expect(result).toEqual([]);
  });

  test("should ignore non-required tool names", () => {
    const result = missingInitToolNames(
      new Set(["initializeProtagonistState", "someOtherTool"]),
    );
    expect(result).toEqual(["createStory", "initializeTaskState"]);
  });
});
