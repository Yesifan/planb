import { readStreamableValue } from "@ai-sdk/rsc";
import { describe, expect, mock, test } from "bun:test";

import { db } from "@/lib/db";
import { chat, message, protagonistState, story } from "@/lib/db/schema";
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

    test("should let archivist initialize story and task state before creating story setting", async () => {
      const now = new Date();
      const chatId = "cc-archivist-init-runtime";

      await db.insert(chat).values({
        id: chatId,
        userId: "test-user",
        title: "Test Archivist Init",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(story).values({
        id: "cc-story-archivist-init",
        chatId,
        source: "三国",
        singularity: "特异点",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(message).values({
        id: "cc-asst-archivist-init",
        chatId,
        role: "assistant",
        text: "请提供更多设定",
        createdAt: now,
      });

      setMockResponses([
        {
          kind: "tool-call",
          toolName: "initializeStoryState",
          input: {
            profile: "主角是诸葛亮，刚从病危中稳住局面。",
            dimensions: [
              { name: "身体", value: 55, summary: "病势初稳" },
              { name: "心智", value: 88, summary: "判断清晰" },
              { name: "威望", value: 82, summary: "军中仍信服" },
              { name: "资源", value: 46, summary: "粮草压力明显" },
              { name: "时机", value: 60, summary: "魏军尚未确认虚实" },
            ],
            worldSnapshot: "## 世界当前时点\n五丈原对峙仍在持续。",
          },
          usage: { inputTokens: 7, outputTokens: 8 },
        },
        {
          kind: "tool-call",
          toolName: "initializeTaskState",
          input: {
            taskState: "## 进行中\n- 稳住五丈原军心：避免魏军识破病情。",
          },
          usage: { inputTokens: 9, outputTokens: 10 },
        },
        {
          kind: "tool-call",
          toolName: "createStory",
          input: {
            title: "五丈原新局",
            type: "历史改编",
            describe: "诸葛亮病势转稳，蜀军仍在五丈原维持战线。",
            worldview: "架空三国，信息传递依赖驿道与军报。",
          },
          usage: { inputTokens: 30, outputTokens: 40 },
        },
        {
          kind: "text",
          text: "第一章：五丈原风云...",
          usage: { inputTokens: 50, outputTokens: 60 },
        },
      ]);

      const { continueConversation } = await import("@/lib/actions/llm");
      const result = await continueConversation(chatId, "开始吧");

      for await (const _ of readStreamableValue(result.content)) void _;
      await new Promise((r) => setTimeout(r, 50));

      const storyRow = await db.query.story.findFirst({
        where: { chatId },
      });
      const protagonist = await db.query.protagonistState.findFirst({
        where: { chatId },
      });
      const assistantMessages = await db.query.message.findMany({
        where: { chatId, role: "assistant" },
        orderBy: { createdAt: "desc" },
      });

      expect(storyRow?.type).toBe("历史改编");
      expect(storyRow?.worldSnapshot).toContain("五丈原对峙");
      expect(storyRow?.taskState).toContain("稳住五丈原军心");
      expect(protagonist?.dimensions).toHaveLength(5);
      expect(assistantMessages[0]?.text).toContain("五丈原风云");
      expect(assistantMessages[0]?.inputTokens).toBe(96);
      expect(assistantMessages[0]?.outputTokens).toBe(118);

      resetMock();
    });
  });

  describe("continueStory", () => {
    test("should run sentinel → oracle → weaver and update runtime state when previous state exists", async () => {
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
        worldSnapshot: "## 世界当前时点\n旧状态",
        taskState: "## 进行中\n- 攻取长安：尚未开始。",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(protagonistState).values({
        id: "cc-protagonist-2",
        chatId,
        profile: "主角是诸葛亮，正在准备北伐。",
        dimensions: [
          { name: "身体", value: 70, summary: "稳定" },
          { name: "心智", value: 80, summary: "稳定" },
          { name: "关系", value: 60, summary: "稳定" },
          { name: "资源", value: 50, summary: "稳定" },
          { name: "命运", value: 40, summary: "稳定" },
        ],
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
          kind: "text",
          text: "剧情大纲：长安之战...",
          usage: { inputTokens: 60, outputTokens: 80 },
        },
        {
          kind: "text",
          text: "第二章：长安烽火...",
          usage: { inputTokens: 50, outputTokens: 60 },
        },
        {
          kind: "tool-call",
          toolName: "updateStoryState",
          input: {
            profile: "主角是诸葛亮，正在推进长安战役。",
            dimensionValues: [68, 84, 64, 48, 57],
            worldSnapshot: "## 当前局势\n长安战役进入相持。",
          },
          usage: { inputTokens: 7, outputTokens: 8 },
        },
        {
          kind: "tool-call",
          toolName: "updateTaskState",
          input: {
            taskState: "## 进行中\n- 攻取长安：战役进入相持。",
          },
          usage: { inputTokens: 9, outputTokens: 10 },
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
      expect(latest?.inputTokens).toBe(136);
      expect(latest?.outputTokens).toBe(178);

      const storyRow = await db.query.story.findFirst({
        where: { chatId },
      });
      const protagonist = await db.query.protagonistState.findFirst({
        where: { chatId },
      });
      expect(storyRow?.worldSnapshot).toContain("长安战役进入相持");
      expect(storyRow?.taskState).toContain("攻取长安");
      expect(protagonist?.dimensions).toHaveLength(5);

      resetMock();
    });

    test("should initialize runtime state during story continuation when previous state does not exist", async () => {
      const now = new Date();
      const chatId = "cc-complete-story-no-runtime";

      await db.insert(chat).values({
        id: chatId,
        userId: "test-user",
        title: "Test Complete No Runtime",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(story).values({
        id: "cc-story-no-runtime",
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
        id: "cc-asst-no-runtime",
        chatId,
        role: "assistant",
        text: "第一章结束，你想做什么？",
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
          kind: "text",
          text: "剧情大纲：长安之战...",
          usage: { inputTokens: 60, outputTokens: 80 },
        },
        {
          kind: "text",
          text: "第二章：长安烽火...",
          usage: { inputTokens: 50, outputTokens: 60 },
        },
        {
          kind: "tool-call",
          toolName: "initializeStoryState",
          input: {
            profile: "主角是诸葛亮，正在推进长安战役。",
            dimensions: [
              { name: "身体", value: 68, summary: "仍能支撑军务" },
              { name: "心智", value: 84, summary: "谋划清晰" },
              { name: "威望", value: 64, summary: "军中信任尚稳" },
              { name: "资源", value: 48, summary: "粮草压力增加" },
              { name: "时机", value: 57, summary: "长安战机未定" },
            ],
            worldSnapshot: "## 当前局势\n长安战役进入相持。",
          },
          usage: { inputTokens: 7, outputTokens: 8 },
        },
        {
          kind: "tool-call",
          toolName: "initializeTaskState",
          input: {
            taskState: "## 进行中\n- 攻取长安：战役进入相持。",
          },
          usage: { inputTokens: 9, outputTokens: 10 },
        },
      ]);

      const { continueConversation } = await import("@/lib/actions/llm");
      const result = await continueConversation(chatId, "进攻长安");

      for await (const _ of readStreamableValue(result.content)) void _;
      await new Promise((r) => setTimeout(r, 50));

      const storyRow = await db.query.story.findFirst({
        where: { chatId },
      });
      const protagonist = await db.query.protagonistState.findFirst({
        where: { chatId },
      });
      const assistantMessages = await db.query.message.findMany({
        where: { chatId, role: "assistant" },
        orderBy: { createdAt: "desc" },
      });
      expect(storyRow?.worldSnapshot).toContain("长安战役进入相持");
      expect(storyRow?.taskState).toContain("攻取长安");
      expect(protagonist?.dimensions).toHaveLength(5);
      expect(assistantMessages[0]?.inputTokens).toBe(136);
      expect(assistantMessages[0]?.outputTokens).toBe(178);

      resetMock();
    });
  });
});
