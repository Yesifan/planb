import { describe, expect, test } from "bun:test";

import { db } from "@/lib/db";
import { chat, story } from "@/lib/db/schema";

import {
  initializeStoryStateData,
  initializeTaskStateData,
  updateStoryStateData,
  updateTaskStateData,
} from "./state";

describe("state tools", () => {
  test("should initialize protagonist state and story runtime text", async () => {
    const now = new Date();
    await db.insert(chat).values({
      id: "state-init-chat",
      userId: "test-user",
      title: "State Init",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(story).values({
      id: "state-init-story",
      chatId: "state-init-chat",
      source: "三国",
      singularity: "特异点",
      createdAt: now,
      updatedAt: now,
    });

    await initializeStoryStateData(db, "state-init-chat", {
      profile:
        "主角是蜀汉丞相诸葛亮，当前目标是稳定北伐局势。重要资源：蜀军约10万兵力，仍可维持北伐战线；军粮30日余量，补给线压力明显。",
      dimensions: [
        { name: "身体", value: 72, summary: "精力尚可" },
        { name: "心智", value: 91, summary: "判断清晰" },
        { name: "关系", value: 68, summary: "朝中仍有阻力" },
        { name: "资源", value: 63, summary: "粮草紧张" },
        { name: "命运", value: 55, summary: "特异点带来变数" },
      ],
      worldSnapshot: "## 当前局势\n蜀汉北伐尚未结束。",
    });

    const protagonist = await db.query.protagonistState.findFirst({
      where: { chatId: "state-init-chat" },
    });
    const storyRow = await db.query.story.findFirst({
      where: { chatId: "state-init-chat" },
    });

    expect(protagonist?.profile).toContain("诸葛亮");
    expect(protagonist?.profile).toContain("蜀军约10万兵力");
    expect(protagonist?.profile).toContain("军粮30日余量");
    expect(protagonist?.dimensions).toHaveLength(5);
    expect(storyRow?.worldSnapshot).toContain("当前局势");
  });

  test("should reject protagonist dimensions when count is not five", async () => {
    await expect(
      initializeStoryStateData(db, "state-invalid-chat", {
        profile: "主角，重要资源：兵力100人。",
        dimensions: [
          { name: "身体", value: 50, summary: "正常" },
          { name: "心智", value: 50, summary: "正常" },
        ],
        worldSnapshot: "## 当前局势\n暂无",
      }),
    ).rejects.toThrow();
  });

  test("should update task state markdown text", async () => {
    const now = new Date();
    await db.insert(chat).values({
      id: "task-update-chat",
      userId: "test-user",
      title: "Task Update",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(story).values({
      id: "task-update-story",
      chatId: "task-update-chat",
      source: "三国",
      singularity: "特异点",
      createdAt: now,
      updatedAt: now,
    });

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

  test("should update protagonist state and world snapshot", async () => {
    const now = new Date();
    await db.insert(chat).values({
      id: "state-update-chat",
      userId: "test-user",
      title: "State Update",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(story).values({
      id: "state-update-story",
      chatId: "state-update-chat",
      source: "三国",
      singularity: "特异点",
      createdAt: now,
      updatedAt: now,
    });
    await initializeStoryStateData(db, "state-update-chat", {
      profile: "主角是诸葛亮。重要资源：军粮40日余量，尚可支撑。",
      dimensions: [
        { name: "身体", value: 70, summary: "稳定" },
        { name: "心智", value: 80, summary: "稳定" },
        { name: "关系", value: 60, summary: "稳定" },
        { name: "资源", value: 50, summary: "稳定" },
        { name: "命运", value: 40, summary: "稳定" },
      ],
      worldSnapshot: "## 当前局势\n旧局势",
    });

    await updateStoryStateData(db, "state-update-chat", {
      profile:
        "主角是诸葛亮，已取得长安战役主动权。重要资源：长安前线兵力2万先锋，已占据要道。",
      dimensionValues: [68, 84, 64, 48, 57],
      worldSnapshot: "## 当前局势\n长安战役进入相持。",
    });

    const protagonist = await db.query.protagonistState.findFirst({
      where: { chatId: "state-update-chat" },
    });
    const storyRow = await db.query.story.findFirst({
      where: { chatId: "state-update-chat" },
    });

    expect(protagonist?.profile).toContain("主动权");
    expect(protagonist?.profile).toContain("长安前线兵力2万先锋");
    expect(protagonist?.dimensions[0]?.value).toBe(68);
    expect(protagonist?.dimensions[0]?.name).toBe("身体");
    expect(protagonist?.dimensions[0]?.summary).toBe("稳定");
    expect(protagonist?.dimensions[4]?.name).toBe("命运");
    expect(protagonist?.dimensions[4]?.summary).toBe("稳定");
    expect(storyRow?.worldSnapshot).toContain("相持");
  });
});
