import { describe, expect, test } from "bun:test";

import { toRuntimeStateModelMessage } from "./utils";

describe("toRuntimeStateModelMessage", () => {
  test("should include protagonist dimensions, world snapshot, and task state", () => {
    const result = toRuntimeStateModelMessage({
      protagonistState: {
        id: "ps-1",
        chatId: "chat-1",
        profile: "主角是诸葛亮。",
        dimensions: [
          { name: "身体", value: 70, summary: "稳定" },
          { name: "心智", value: 90, summary: "清晰" },
          { name: "关系", value: 60, summary: "可用" },
          { name: "资源", value: 50, summary: "紧张" },
          { name: "命运", value: 40, summary: "摇摆" },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      story: {
        id: "story-1",
        chatId: "chat-1",
        source: "三国",
        singularity: "特异点",
        type: "历史",
        worldview: "世界",
        system: null,
        worldSnapshot: "## 当前局势\n北伐推进中。",
        taskState: "## 进行中\n- 稳住粮道",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(result?.content).toContain("主角五维");
    expect(result?.content).toContain("心智: 90/100");
    expect(result?.content).toContain("北伐推进中");
    expect(result?.content).toContain("稳住粮道");
  });
});
