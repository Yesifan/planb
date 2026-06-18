import { readStreamableValue } from "@ai-sdk/rsc";
import { describe, expect, mock, test } from "bun:test";

import { db } from "@/lib/db";
import { chat, message, protagonistState, story, toolCall } from "@/lib/db/schema";
import {
  getMockCallOptions,
  remainingMockResponses,
  resetMock,
  setMockResponses,
} from "@/lib/llm/mock-provider";

mock.module("@/lib/auth/server", () => ({
  getSessionWithRedirect: async () => ({
    user: { id: "test-user" },
  }),
}));

async function setupIncompleteStory(chatId: string) {
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
  await db.insert(message).values({
    id: `${chatId}-assistant-question`,
    chatId,
    role: "assistant",
    text: "请提供更多设定",
    createdAt: now,
  });
}

const createStoryToolResponse = {
  kind: "tool-call" as const,
  toolName: "createStory",
  input: {
    title: "五丈原新局",
    type: "历史改编",
    worldview: "架空三国，信息传递依赖驿道与军报。",
    worldSnapshot: "## 世界当前时点\n五丈原对峙仍在持续。",
  },
  usage: { inputTokens: 3, outputTokens: 4 },
};

const initializeProtagonistStateToolResponse = {
  kind: "tool-call" as const,
  toolName: "initializeProtagonistState",
  input: {
    profile: "主角是诸葛亮，刚从病危中稳住局面，当前身处五丈原蜀军大营。",
    resources:
      "## 可用资源\n\n### 蜀军\n- 描述：约 10 万兵力，仍在五丈原维持战线。\n- 价值：可支撑北伐战线。\n- 备注：补给线压力明显。",
    dimensions: [
      { name: "身体", value: 55, summary: "病势初稳" },
      { name: "心智", value: 88, summary: "判断清晰" },
      { name: "威望", value: 82, summary: "军中仍信服" },
      { name: "资源", value: 46, summary: "粮草压力明显" },
      { name: "时机", value: 60, summary: "魏军尚未确认虚实" },
    ],
  },
  usage: { inputTokens: 5, outputTokens: 6 },
};

const initializeTaskStateToolResponse = {
  kind: "tool-call" as const,
  toolName: "initializeTaskState",
  input: {
    taskState: "## 进行中\n- 稳住五丈原军心：避免魏军识破病情。",
  },
  usage: { inputTokens: 7, outputTokens: 8 },
};

const updateProtagonistStateToolResponse = {
  kind: "tool-call" as const,
  toolName: "updateProtagonistState",
  input: {
    profile: "主角是诸葛亮，正在推进长安战役。",
    resources:
      "## 可用资源\n\n### 长安先锋\n- 描述：2 万先锋，已占据要道。\n- 价值：控制长安外围。",
    dimensionValues: [68, 84, 64, 48, 57],
  },
  usage: { inputTokens: 5, outputTokens: 6 },
};

const updateWorldSnapshotToolResponse = {
  kind: "tool-call" as const,
  toolName: "updateWorldSnapshot",
  input: {
    worldSnapshot: "## 当前局势\n长安战役进入相持。",
  },
  usage: { inputTokens: 3, outputTokens: 4 },
};

const updateTaskStateToolResponse = {
  kind: "tool-call" as const,
  toolName: "updateTaskState",
  input: {
    taskState: "## 进行中\n- 攻取长安：战役进入相持。",
  },
  usage: { inputTokens: 7, outputTokens: 8 },
};

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

    expect(JSON.stringify(getMockCallOptions()[0])).not.toContain(
      "reviewBranch",
    );

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
        initializeProtagonistStateToolResponse,
        initializeTaskStateToolResponse,
        createStoryToolResponse,
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
        initializeProtagonistStateToolResponse,
        initializeTaskStateToolResponse,
        createStoryToolResponse,
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
      expect(assistantMessages[0]?.inputTokens).toBe(65);
      expect(assistantMessages[0]?.outputTokens).toBe(78);

      resetMock();
    });

    test("should persist createStory worldSnapshot and protagonist state resources", async () => {
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
          toolName: "createStory",
          input: {
            title: "五丈原新局",
            type: "历史改编",
            worldview: "架空三国，信息传递依赖驿道与军报。",
            worldSnapshot: "## 世界当前时点\n五丈原对峙仍在持续。",
          },
          usage: { inputTokens: 30, outputTokens: 40 },
        },
        {
          kind: "tool-call",
          toolName: "initializeProtagonistState",
          input: {
            profile: "主角是诸葛亮，刚从病危中稳住局面。",
            resources:
              "## 可用资源\n\n### 蜀军\n- 描述：约 10 万兵力。\n- 价值：可支撑北伐战线。",
            dimensions: [
              { name: "身体", value: 55, summary: "病势初稳" },
              { name: "心智", value: 88, summary: "判断清晰" },
              { name: "威望", value: 82, summary: "军中仍信服" },
              { name: "资源", value: 46, summary: "粮草压力明显" },
              { name: "时机", value: 60, summary: "魏军尚未确认虚实" },
            ],
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
      expect(protagonist?.resources).toContain("蜀军");
      expect(protagonist?.dimensions).toHaveLength(5);
      expect(assistantMessages[0]?.text).toContain("五丈原风云");
      expect(assistantMessages[0]?.inputTokens).toBe(96);
      expect(assistantMessages[0]?.outputTokens).toBe(118);

      resetMock();
    });

    test("should continue running archivist until all required initialization tools are completed", async () => {
      const chatId = "cc-completeness-stopwhen";
      await setupIncompleteStory(chatId);

      setMockResponses([
        initializeTaskStateToolResponse,
        createStoryToolResponse,
        initializeProtagonistStateToolResponse,
        {
          kind: "text",
          text: "第一章：五丈原风云再起...",
          usage: { inputTokens: 15, outputTokens: 16 },
        },
      ]);

      const { continueConversation } = await import("@/lib/actions/llm");
      const result = await continueConversation(chatId, "开始吧");

      for await (const _ of readStreamableValue(result.content)) void _;
      await new Promise((r) => setTimeout(r, 50));

      const storyRow = await db.query.story.findFirst({ where: { chatId } });
      const assistantMessages = await db.query.message.findMany({
        where: { chatId, role: "assistant" },
        orderBy: { createdAt: "desc" },
      });

      expect(storyRow?.worldSnapshot).toContain("五丈原对峙");
      expect(assistantMessages[0]?.text).toContain("五丈原风云");

      resetMock();
    });

    test("should fail with missing tool names when archivist reaches max steps without completing initialization", async () => {
      const chatId = "cc-missing-tools-max-steps";
      await setupIncompleteStory(chatId);

      setMockResponses([
        {
          kind: "text",
          text: "没有调用初始化工具。",
          usage: { inputTokens: 11, outputTokens: 12 },
        },
      ]);

      const { continueConversation } = await import("@/lib/actions/llm");
      const result = await continueConversation(chatId, "开始吧");

      let caught: unknown;
      try {
        for await (const _ of readStreamableValue(result.content)) void _;
      } catch (error) {
        caught = error;
      }

      expect(String(caught)).toContain("createStory");
      expect(String(caught)).toContain("initializeProtagonistState");
      expect(String(caught)).toContain("initializeTaskState");

      resetMock();
    });

    test("should return follow-up question without running weaver when archivist asks during setup continuation", async () => {
      const now = new Date();
      const chatId = "cc-follow-up-question";

      await db.insert(chat).values({
        id: chatId,
        userId: "test-user",
        title: "Follow Up",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(story).values({
        id: "cc-story-follow-up-question",
        chatId,
        source: "三国",
        singularity: "特异点",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(message).values({
        id: "cc-asst-follow-up-q1",
        chatId,
        role: "assistant",
        text: "请提供角色设定",
        createdAt: now,
      });
      await db.insert(toolCall).values({
        id: "cc-tool-follow-up-q1",
        messageId: "cc-asst-follow-up-q1",
        name: "createQuestion",
        input: {
          title: "角色设定",
          questions: [{ question: "你想扮演谁？" }],
        },
        createdAt: now,
      });

      setMockResponses([
        {
          kind: "tool-call",
          toolName: "createQuestion",
          input: {
            title: "继续补充",
            questions: [{ question: "故事开始时间？" }],
          },
          text: "还需要一个设定：",
          usage: { inputTokens: 30, outputTokens: 40 },
        },
        {
          kind: "text",
          text: "如果 Weaver 被调用就会消费这条响应",
          usage: { inputTokens: 50, outputTokens: 60 },
        },
      ]);

      const { continueConversation } = await import("@/lib/actions/llm");
      const result = await continueConversation(chatId, "我想扮演赵云");

      const chunks: unknown[] = [];
      for await (const chunk of readStreamableValue(result.content)) {
        chunks.push(chunk);
      }
      await new Promise((r) => setTimeout(r, 50));

      const assistantMessage = await db.query.message.findFirst({
        where: { id: result.messageId },
        with: { toolCalls: true },
      });
      const answeredQuestion = await db.query.toolCall.findFirst({
        where: { id: "cc-tool-follow-up-q1" },
      });

      expect(answeredQuestion?.result).toBe("我想扮演赵云");
      expect(assistantMessage?.text).toContain("还需要一个设定");
      expect(
        assistantMessage?.toolCalls.some((tc) => tc.name === "createQuestion"),
      ).toBe(true);
      expect(JSON.stringify(chunks)).toContain('"toolName":"createQuestion"');
      expect(remainingMockResponses()).toBe(1);

      resetMock();
    });

    test("should include recent question answers and exclude unrelated messages when answering another setup question", async () => {
      const now = new Date();
      const chatId = "cc-multi-question-context";
      const minuteAgo = new Date(now.getTime() - 60_000);

      await db.insert(chat).values({
        id: chatId,
        userId: "test-user",
        title: "Multi Question",
        createdAt: minuteAgo,
        updatedAt: minuteAgo,
      });
      await db.insert(story).values({
        id: "cc-story-multi-question-context",
        chatId,
        source: "三国",
        singularity: "特异点",
        createdAt: minuteAgo,
        updatedAt: minuteAgo,
      });
      await db.insert(message).values([
        {
          id: "cc-asst-multi-q1",
          chatId,
          role: "assistant",
          text: "第一轮问题",
          createdAt: new Date(now.getTime() - 40_000),
        },
        {
          id: "cc-asst-multi-unrelated",
          chatId,
          role: "assistant",
          text: "这条普通 assistant 消息不应该进入设定问答上下文",
          createdAt: new Date(now.getTime() - 30_000),
        },
        {
          id: "cc-asst-multi-q2",
          chatId,
          role: "assistant",
          text: "第二轮问题",
          createdAt: new Date(now.getTime() - 20_000),
        },
      ]);
      await db.insert(toolCall).values([
        {
          id: "cc-tool-multi-q1",
          messageId: "cc-asst-multi-q1",
          name: "createQuestion",
          input: {
            title: "角色",
            questions: [{ question: "你想扮演谁？" }],
          },
          result: "我想扮演赵云",
          createdAt: new Date(now.getTime() - 40_000),
        },
        {
          id: "cc-tool-multi-q2",
          messageId: "cc-asst-multi-q2",
          name: "createQuestion",
          input: {
            title: "时间",
            questions: [{ question: "故事开始时间？" }],
          },
          createdAt: new Date(now.getTime() - 20_000),
        },
      ]);

      setMockResponses([
        initializeProtagonistStateToolResponse,
        initializeTaskStateToolResponse,
        createStoryToolResponse,
        {
          kind: "text",
          text: "第一章：风云再起...",
          usage: { inputTokens: 50, outputTokens: 60 },
        },
      ]);

      const { continueConversation } = await import("@/lib/actions/llm");
      const result = await continueConversation(chatId, "建兴十二年五丈原");

      for await (const _ of readStreamableValue(result.content)) void _;
      await new Promise((r) => setTimeout(r, 50));

      const archivistCall = JSON.stringify(getMockCallOptions()[0]);
      expect(archivistCall).toContain("你想扮演谁？");
      expect(archivistCall).toContain("我想扮演赵云");
      expect(archivistCall).toContain("故事开始时间？");
      expect(archivistCall).toContain("建兴十二年五丈原");
      expect(archivistCall).not.toContain("reviewBranch");
      expect(archivistCall).not.toContain(
        "这条普通 assistant 消息不应该进入设定问答上下文",
      );

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
        resources:
          "## 可用资源\n\n### 旧资源\n- 描述：测试资源。\n- 价值：测试。",
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
          kind: "tool-call",
          toolName: "reviewBranch",
          input: {
            content: "玩家操作：进攻长安\n故事大纲草案：长安之战...",
          },
          usage: { inputTokens: 11, outputTokens: 12 },
        },
        {
          kind: "text",
          text: "### 事实一致性审查\n\n通过\n\n### 修改建议\n\n- 无需修改",
          usage: { inputTokens: 13, outputTokens: 14 },
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
        updateProtagonistStateToolResponse,
        updateWorldSnapshotToolResponse,
        updateTaskStateToolResponse,
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
      expect(latest?.inputTokens).toBe(160);
      expect(latest?.outputTokens).toBe(205);

      const oracleCall = JSON.stringify(getMockCallOptions()[1]);
      expect(oracleCall).toContain("reviewBranch");

      const storyRow = await db.query.story.findFirst({
        where: { chatId },
      });
      const protagonist = await db.query.protagonistState.findFirst({
        where: { chatId },
      });
      expect(storyRow?.worldSnapshot).toContain("长安战役进入相持");
      expect(storyRow?.taskState).toContain("攻取长安");
      expect(protagonist?.resources).toContain("长安先锋");
      expect(protagonist?.dimensions).toHaveLength(5);

      resetMock();
    });

    test("should initialize protagonist state fallback when previous protagonist state does not exist", async () => {
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
        worldview: "架空三国",
        worldSnapshot: "## 世界当前时点\n尚无运行状态",
        taskState: "## 进行中\n- 攻取长安：尚未开始。",
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
          kind: "tool-call",
          toolName: "reviewBranch",
          input: {
            content: "玩家操作：进攻长安\n故事大纲草案：长安之战...",
          },
          usage: { inputTokens: 11, outputTokens: 12 },
        },
        {
          kind: "text",
          text: "### 事实一致性审查\n\n通过\n\n### 修改建议\n\n- 无需修改",
          usage: { inputTokens: 13, outputTokens: 14 },
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
        initializeProtagonistStateToolResponse,
        updateTaskStateToolResponse,
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
      expect(storyRow?.taskState).toContain("攻取长安");
      expect(protagonist?.profile).toContain("诸葛亮");
      expect(protagonist?.resources).toContain("蜀军");
      expect(protagonist?.dimensions).toHaveLength(5);
      expect(assistantMessages[0]?.inputTokens).toBe(157);
      expect(assistantMessages[0]?.outputTokens).toBe(201);
      expect(JSON.stringify(getMockCallOptions()[1])).toContain("reviewBranch");

      resetMock();
    });

    test("should allow runtimekeeper to finish without any tool calls", async () => {
      const now = new Date();
      const chatId = "cc-runtimekeeper-no-tools";

      await db.insert(chat).values({
        id: chatId,
        userId: "test-user",
        title: "Test No Tools",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(story).values({
        id: "cc-story-no-tools",
        chatId,
        source: "三国",
        singularity: "特异点",
        type: "历史改编",
        worldview: "架空三国",
        worldSnapshot: "## 世界当前时点\n旧状态",
        taskState: "## 进行中\n- 攻取长安：尚未开始。",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(protagonistState).values({
        id: "cc-protagonist-no-tools",
        chatId,
        profile: "主角是诸葛亮。",
        resources: "## 可用资源\n暂无",
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
        id: "cc-asst-no-tools",
        chatId,
        role: "assistant",
        text: "第一章结束，你想做什么？",
        createdAt: now,
      });
      await db.insert(message).values({
        id: "cc-user-no-tools",
        chatId,
        role: "user",
        text: "按兵不动",
        createdAt: now,
      });

      setMockResponses([
        {
          kind: "tool-call",
          toolName: "judgeInput",
          input: { decision: "approve", content: "主角决定按兵不动" },
          text: "审查通过",
          usage: { inputTokens: 10, outputTokens: 20 },
        },
        {
          kind: "tool-call",
          toolName: "reviewBranch",
          input: {
            content: "玩家操作：按兵不动\n故事大纲草案：无变化...",
          },
          usage: { inputTokens: 11, outputTokens: 12 },
        },
        {
          kind: "text",
          text: "### 事实一致性审查\n\n通过\n\n### 修改建议\n\n- 无需修改",
          usage: { inputTokens: 13, outputTokens: 14 },
        },
        {
          kind: "text",
          text: "剧情大纲：无变化...",
          usage: { inputTokens: 60, outputTokens: 80 },
        },
        {
          kind: "text",
          text: "第二章：风平浪静...",
          usage: { inputTokens: 50, outputTokens: 60 },
        },
        {
          kind: "text",
          text: "本轮没有状态需要更新。",
          usage: { inputTokens: 5, outputTokens: 6 },
        },
      ]);

      const { continueConversation } = await import("@/lib/actions/llm");
      const result = await continueConversation(chatId, "按兵不动");

      for await (const _ of readStreamableValue(result.content)) void _;
      await new Promise((r) => setTimeout(r, 50));

      const storyRow = await db.query.story.findFirst({
        where: { chatId },
      });
      const protagonist = await db.query.protagonistState.findFirst({
        where: { chatId },
      });
      expect(storyRow?.worldSnapshot).toContain("旧状态");
      expect(storyRow?.taskState).toContain("攻取长安");
      expect(protagonist?.resources).toContain("暂无");

      resetMock();
    });

    test("should allow runtimekeeper to update only task state", async () => {
      const now = new Date();
      const chatId = "cc-runtimekeeper-task-only";

      await db.insert(chat).values({
        id: chatId,
        userId: "test-user",
        title: "Test Task Only",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(story).values({
        id: "cc-story-task-only",
        chatId,
        source: "三国",
        singularity: "特异点",
        type: "历史改编",
        worldview: "架空三国",
        worldSnapshot: "## 世界当前时点\n旧状态",
        taskState: "## 进行中\n- 攻取长安：尚未开始。",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(protagonistState).values({
        id: "cc-protagonist-task-only",
        chatId,
        profile: "主角是诸葛亮。",
        resources: "## 可用资源\n暂无",
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
        id: "cc-asst-task-only",
        chatId,
        role: "assistant",
        text: "第一章结束，你想做什么？",
        createdAt: now,
      });
      await db.insert(message).values({
        id: "cc-user-task-only",
        chatId,
        role: "user",
        text: "整军备战",
        createdAt: now,
      });

      setMockResponses([
        {
          kind: "tool-call",
          toolName: "judgeInput",
          input: { decision: "approve", content: "主角决定整军备战" },
          text: "审查通过",
          usage: { inputTokens: 10, outputTokens: 20 },
        },
        {
          kind: "tool-call",
          toolName: "reviewBranch",
          input: {
            content: "玩家操作：整军备战\n故事大纲草案：准备进攻...",
          },
          usage: { inputTokens: 11, outputTokens: 12 },
        },
        {
          kind: "text",
          text: "### 事实一致性审查\n\n通过\n\n### 修改建议\n\n- 无需修改",
          usage: { inputTokens: 13, outputTokens: 14 },
        },
        {
          kind: "text",
          text: "剧情大纲：准备进攻...",
          usage: { inputTokens: 60, outputTokens: 80 },
        },
        {
          kind: "text",
          text: "第二章：整军备战...",
          usage: { inputTokens: 50, outputTokens: 60 },
        },
        updateTaskStateToolResponse,
      ]);

      const { continueConversation } = await import("@/lib/actions/llm");
      const result = await continueConversation(chatId, "整军备战");

      for await (const _ of readStreamableValue(result.content)) void _;
      await new Promise((r) => setTimeout(r, 50));

      const storyRow = await db.query.story.findFirst({
        where: { chatId },
      });
      const protagonist = await db.query.protagonistState.findFirst({
        where: { chatId },
      });
      expect(storyRow?.worldSnapshot).toContain("旧状态");
      expect(storyRow?.taskState).toContain("攻取长安");
      expect(protagonist?.resources).toContain("暂无");

      resetMock();
    });
  });
});
