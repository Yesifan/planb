import { describe, expect, test } from "bun:test";

import { db } from "@/lib/db";
import { chat, story } from "@/lib/db/schema";

import {
  initializeProtagonistStateData,
  initializeTaskStateData,
  updateProtagonistStateData,
  updateTaskStateData,
  updateWorldSnapshotData,
} from "./state";

async function setupChatAndStory(chatId: string) {
  const now = new Date();
  await db.insert(chat).values({
    id: chatId,
    userId: "test-user",
    title: "Test",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(story).values({
    id: `${chatId}-story`,
    chatId,
    source: "三国",
    singularity: "特异点",
    createdAt: now,
    updatedAt: now,
  });
}

function baseDimensions() {
  return [
    { name: "身体", value: 70, summary: "稳定" },
    { name: "心智", value: 80, summary: "稳定" },
    { name: "关系", value: 60, summary: "稳定" },
    { name: "资源", value: 50, summary: "稳定" },
    { name: "命运", value: 40, summary: "稳定" },
  ];
}

function baseResources() {
  return "## 可用资源\n\n### 蜀军\n- 描述：约 10 万兵力，仍在五丈原维持战线。\n- 价值：可支撑北伐战线。\n- 备注：补给线压力明显。";
}

describe("state tools", () => {
  test("should initialize protagonist state without writing world snapshot", async () => {
    await setupChatAndStory("state-init-chat");

    await initializeProtagonistStateData(db, "state-init-chat", {
      profile: "主角是蜀汉丞相诸葛亮，当前目标是稳定北伐局势。",
      resources: baseResources(),
      dimensions: baseDimensions(),
    });

    const protagonist = await db.query.protagonistState.findFirst({
      where: { chatId: "state-init-chat" },
    });
    const storyRow = await db.query.story.findFirst({
      where: { chatId: "state-init-chat" },
    });

    expect(protagonist?.profile).toContain("诸葛亮");
    expect(protagonist?.resources).toContain("蜀军");
    expect(protagonist?.dimensions).toHaveLength(5);
    expect(storyRow?.worldSnapshot).toBeNull();
  });

  test("should reject protagonist dimensions when count is not five", async () => {
    await expect(
      initializeProtagonistStateData(db, "state-invalid-chat", {
        profile: "主角。",
        resources: "## 可用资源\n暂无",
        dimensions: [
          { name: "身体", value: 50, summary: "正常" },
          { name: "心智", value: 50, summary: "正常" },
        ],
      }),
    ).rejects.toThrow();
  });

  test("should update task state markdown text", async () => {
    await setupChatAndStory("task-update-chat");

    await initializeTaskStateData(db, "task-update-chat", {
      taskState: "## 进行中\n暂无",
    });
    await updateTaskStateData(db, "task-update-chat", {
      taskState: "## 进行中\n- 稳住北伐粮道：已查明粮草缺口。",
    });

    const storyRow = await db.query.story.findFirst({
      where: { chatId: "task-update-chat" },
    });

    expect(storyRow?.taskState).toContain("稳住北伐粮道");
  });

  test("should update protagonist state while preserving dimension names and summaries", async () => {
    await setupChatAndStory("state-update-chat");
    await initializeProtagonistStateData(db, "state-update-chat", {
      profile: "主角是诸葛亮，正在准备北伐。",
      resources: "## 可用资源\n\n### 军粮\n- 描述：40 日余量。\n- 价值：尚可支撑。",
      dimensions: baseDimensions(),
    });

    await updateProtagonistStateData(db, "state-update-chat", {
      profile: "主角是诸葛亮，已取得长安战役主动权。",
      resources:
        "## 可用资源\n\n### 长安先锋\n- 描述：2 万先锋，已占据要道。\n- 价值：控制长安外围。",
      dimensionValues: [68, 84, 64, 48, 57],
    });

    const protagonist = await db.query.protagonistState.findFirst({
      where: { chatId: "state-update-chat" },
    });

    expect(protagonist?.profile).toContain("主动权");
    expect(protagonist?.resources).toContain("长安先锋");
    expect(protagonist?.dimensions[0]?.value).toBe(68);
    expect(protagonist?.dimensions[0]?.name).toBe("身体");
    expect(protagonist?.dimensions[0]?.summary).toBe("稳定");
    expect(protagonist?.dimensions[4]?.name).toBe("命运");
    expect(protagonist?.dimensions[4]?.summary).toBe("稳定");
  });

  test("should update world snapshot independently from protagonist state", async () => {
    await setupChatAndStory("world-snapshot-update-chat");

    await updateWorldSnapshotData(db, "world-snapshot-update-chat", {
      worldSnapshot: "## 当前局势\n长安战役进入相持。",
    });

    const storyRow = await db.query.story.findFirst({
      where: { chatId: "world-snapshot-update-chat" },
    });

    expect(storyRow?.worldSnapshot).toContain("长安战役进入相持");
  });
});
