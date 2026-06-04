import { readStreamableValue } from "@ai-sdk/rsc";
import { describe, expect, mock, test } from "bun:test";

import { db } from "@/lib/db";
import { chat, message, story } from "@/lib/db/schema";
import { resetMock, setMockResponses } from "@/lib/llm/mock-provider";

mock.module("@/lib/auth/server", () => ({
  getSessionWithRedirect: async () => ({
    user: { id: "test-user" },
  }),
}));

describe("createStory", () => {
  test("should persist chat/story and emit createQuestion tool call", async () => {
    setMockResponses([
      {
        kind: "tool-call",
        toolName: "createQuestion",
        input: {
          title: "请补充关键设定",
          describe: "为了构建世界观，需要更多背景信息",
          questions: [
            { question: "主角的初始能力？", describe: "影响后续推演" },
            { question: "故事的主要矛盾？" },
          ],
        },
        text: "好的，我需要先了解几件事：",
        usage: { inputTokens: 100, outputTokens: 200 },
      },
    ]);

    const { createStory } = await import("@/lib/actions/llm");
    const result = await createStory("三国演义", "如果诸葛亮没有病死五丈原");

    for await (const _ of readStreamableValue(result.content)) void _;
    await new Promise((r) => setTimeout(r, 50));

    const chatRow = await db.query.chat.findFirst({
      where: { id: result.id },
    });
    expect(chatRow?.title).toBe("三国演义");
    expect(chatRow?.userId).toBe("test-user");

    const storyRow = await db.query.story.findFirst({
      where: { chatId: result.id },
    });
    expect(storyRow?.source).toBe("三国演义");
    expect(storyRow?.singularity).toBe("如果诸葛亮没有病死五丈原");

    const messageRow = await db.query.message.findFirst({
      where: { id: result.messageId },
      with: { toolCalls: true },
    });
    expect(messageRow?.role).toBe("assistant");
    expect(messageRow?.inputTokens).toBe(100);
    expect(messageRow?.outputTokens).toBe(200);

    const createQuestionCall = messageRow?.toolCalls.find(
      (tc) => tc.name === "createQuestion",
    );
    expect(createQuestionCall).toBeDefined();
    expect(createQuestionCall?.input).toMatchObject({
      title: "请补充关键设定",
      questions: [
        { question: "主角的初始能力？" },
        { question: "故事的主要矛盾？" },
      ],
    });

    resetMock();
  });
});

describe("continueConversation", () => {
  describe("continueCreateStory", () => {
    test("should return persisted assistant message id when user message is created", async () => {
      const now = new Date();
      const chatId = "cc-message-id";

      await db.insert(chat).values({
        id: chatId,
        userId: "test-user",
        title: "Test",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(story).values({
        id: "cc-story-message-id",
        chatId,
        source: "三国",
        singularity: "特异点",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(message).values({
        id: "cc-asst-message-id",
        chatId,
        role: "assistant",
        text: "请提供更多设定",
        createdAt: now,
      });

      setMockResponses([
        {
          kind: "text",
          text: "设定补充完成",
          usage: { inputTokens: 30, outputTokens: 40 },
        },
        {
          kind: "text",
          text: "第一章：风云再起...",
          usage: { inputTokens: 50, outputTokens: 60 },
        },
      ]);

      const { continueConversation } = await import("@/lib/actions/llm");
      const result = await continueConversation(chatId, "继续");

      for await (const _ of readStreamableValue(result.content)) void _;
      await new Promise((r) => setTimeout(r, 50));

      const assistantMessage = await db.query.message.findFirst({
        where: { id: result.messageId },
      });
      expect(assistantMessage?.role).toBe("assistant");
      expect(assistantMessage?.text).toContain("风云再起");

      const userMessages = await db.query.message.findMany({
        where: { chatId, role: "user" },
      });
      expect(userMessages.map((m) => m.id)).not.toContain(result.messageId);

      resetMock();
    });

    test("should run archivist+weaver when story is incomplete", async () => {
      const now = new Date();
      const chatId = "cc-incomplete-story";

      await db.insert(chat).values({
        id: chatId,
        userId: "test-user",
        title: "Test",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(story).values({
        id: "cc-story-1",
        chatId,
        source: "三国",
        singularity: "特异点",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(message).values({
        id: "cc-asst-1",
        chatId,
        role: "assistant",
        text: "请提供更多设定",
        createdAt: now,
      });
      await db.insert(message).values({
        id: "cc-user-1",
        chatId,
        role: "user",
        text: "开始吧",
        createdAt: now,
      });

      setMockResponses([
        {
          kind: "text",
          text: "设定补充完成",
          usage: { inputTokens: 30, outputTokens: 40 },
        },
        {
          kind: "text",
          text: "第一章：风云再起...",
          usage: { inputTokens: 50, outputTokens: 60 },
        },
      ]);

      const { continueConversation } = await import("@/lib/actions/llm");
      const result = await continueConversation(chatId, "继续");

      for await (const _ of readStreamableValue(result.content)) void _;
      await new Promise((r) => setTimeout(r, 50));

      const userMessages = await db.query.message.findMany({
        where: { chatId, role: "user" },
      });
      expect(userMessages.some((m) => m.text === "继续")).toBe(true);

      const assistantMessages = await db.query.message.findMany({
        where: { chatId, role: "assistant" },
        orderBy: { createdAt: "desc" },
      });
      expect(assistantMessages[0]?.text).toContain("风云再起");
      expect(assistantMessages[0]?.inputTokens).toBe(80);
      expect(assistantMessages[0]?.outputTokens).toBe(100);

      resetMock();
    });
  });

  describe("continueStory", () => {
    test("should run sentinel → oracle (with reviewBranch) → weaver when story is complete", async () => {
      const now = new Date();
      const chatId = "cc-complete-story";

      await db.insert(chat).values({
        id: chatId,
        userId: "test-user",
        title: "Test Complete",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(story).values({
        id: "cc-story-2",
        chatId,
        source: "三国",
        singularity: "特异点",
        type: "历史改编",
        describe: "蜀汉延续的故事",
        worldview: "架空三国",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(message).values({
        id: "cc-asst-2",
        chatId,
        role: "assistant",
        text: "第一章结束，你想做什么？",
        createdAt: now,
      });
      await db.insert(message).values({
        id: "cc-user-2",
        chatId,
        role: "user",
        text: "进攻长安",
        createdAt: now,
      });

      setMockResponses([
        {
          kind: "tool-call",
          toolName: "judgeInput",
          input: { decision: "approve", content: "主角决定进攻长安" },
          text: "审查通过",
          usage: { inputTokens: 10, outputTokens: 20 },
        },
        {
          kind: "tool-call",
          toolName: "reviewBranch",
          input: { content: "草拟分支：诸葛亮亲率大军北伐..." },
          usage: { inputTokens: 40, outputTokens: 50 },
        },
        {
          kind: "text",
          text: "审查通过：剧情合理",
          usage: { inputTokens: 20, outputTokens: 30 },
        },
        {
          kind: "text",
          text: "剧情大纲：长安之战...",
          usage: { inputTokens: 60, outputTokens: 80 },
        },
        {
          kind: "text",
          text: "第二章：长安烽火...",
          usage: { inputTokens: 50, outputTokens: 60 },
        },
      ]);

      const { continueConversation } = await import("@/lib/actions/llm");
      const result = await continueConversation(chatId, "进攻长安");

      for await (const _ of readStreamableValue(result.content)) void _;
      await new Promise((r) => setTimeout(r, 50));

      const historyRows = await db.query.history.findMany({
        where: { chatId },
      });
      expect(historyRows.some((h) => h.content.includes("长安之战"))).toBe(
        true,
      );

      const assistantMessages = await db.query.message.findMany({
        where: { chatId, role: "assistant" },
        orderBy: { createdAt: "desc" },
      });
      const latest = assistantMessages[0];
      expect(latest?.text).toContain("长安烽火");
      expect(latest?.inputTokens).toBe(180);
      expect(latest?.outputTokens).toBe(240);

      resetMock();
    });
  });
});
