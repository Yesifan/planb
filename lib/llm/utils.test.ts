import { describe, expect, test } from "bun:test";

import { toRuntimeStateModelMessage } from "./utils";

function createProtagonistState(resources: string | null) {
  return {
    id: "ps-1",
    chatId: "chat-1",
    profile: "主角是诸葛亮。",
    resources,
    dimensions: [
      { name: "身体", value: 70, summary: "稳定" },
      { name: "心智", value: 90, summary: "清晰" },
      { name: "关系", value: 60, summary: "可用" },
      { name: "资源", value: 50, summary: "紧张" },
      { name: "命运", value: 40, summary: "摇摆" },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const storyFixture = {
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
};

describe("toRuntimeStateModelMessage", () => {
  test("should include protagonist dimensions, world snapshot, and task state", () => {
    const result = toRuntimeStateModelMessage({
      protagonistState: createProtagonistState(
        "## 可用资源\n\n### 蜀军\n- 描述：约 10 万兵力。",
      ),
      story: storyFixture,
    });

    expect(result?.content).toContain("主角五维");
    expect(result?.content).toContain("心智: 90/100");
    expect(result?.content).toContain("北伐推进中");
    expect(result?.content).toContain("稳住粮道");
  });

  test("should include resources section when resources are present", () => {
    const result = toRuntimeStateModelMessage({
      protagonistState: createProtagonistState(
        "## 可用资源\n\n### 蜀军\n- 描述：约 10 万兵力。",
      ),
      story: storyFixture,
    });

    expect(result?.content).toContain("可用资源");
    expect(result?.content).toContain("蜀军");
  });

  test("should not break context when resources is null", () => {
    const result = toRuntimeStateModelMessage({
      protagonistState: createProtagonistState(null),
      story: storyFixture,
    });

    expect(result?.content).toContain("主角五维");
    expect(result?.content).toContain("心智: 90/100");
    expect(result?.content).not.toContain("可用资源");
  });
});
