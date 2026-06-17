"use server";

import { createStreamableValue } from "@ai-sdk/rsc";
import {
  hasToolCall,
  type ModelMessage,
  type OnFinishEvent,
  stepCountIs,
  type ToolSet,
  type UIMessageChunk,
} from "ai";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import { getSessionWithRedirect } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
  chat,
  history,
  message,
  MessageWithToolCall,
  NewMessage,
  story,
  toolCall,
} from "@/lib/db/schema";
import {
  archivist,
  oracle,
  sentinel,
  statekeeper,
  taskmaster,
  weaver,
} from "@/lib/llm";
import {
  isArchivistInitComplete,
  missingInitToolNames,
} from "@/lib/llm/archivist-init";
import { saveMessageWithTool } from "@/lib/llm/db";
import {
  AccessDeniedError,
  InvalidInputError,
  MessageNotFoundError,
} from "@/lib/llm/errors";
import { createLLMLogging } from "@/lib/llm/logging";
import { estimateModelMessageTokens } from "@/lib/llm/token";
import { addUsage, createTokenAccumulator } from "@/lib/llm/usage";
import {
  toHistoryModelMessage,
  toModelMessage,
  toModelMessages,
  toRuntimeStateModelMessage,
  toStoryModelMessage,
} from "@/lib/llm/utils";

import { AgentStatusEvent, ToolContext } from "../llm/type";
import { getChatHistory, getChatQuestions, getLastestChatMessage } from "./db";

async function ensureChatAccess(chatId: string, userId: string) {
  const found = await db.query.chat.findFirst({
    where: { id: chatId },
    columns: { id: true, userId: true },
  });
  if (!found) {
    throw new MessageNotFoundError({
      message: `Chat ${chatId} not found`,
      chatId,
    });
  }
  if (found.userId !== userId) {
    throw new AccessDeniedError({ resource: "chat", resourceId: chatId });
  }
}

interface StreamUpdater {
  update(value: UIMessageChunk | AgentStatusEvent): void;
  done(): void;
}

const AGENT_STATUS_TEXT = {
  Sentinel: "正在审查输入...",
  Oracle: "正在生成大纲...",
  Weaver: "正在撰写故事...",
  Archivist: "正在构建世界观...",
  Statekeeper: "正在整理世界状态...",
  Taskmaster: "正在整理任务...",
} as const;

const ORACLE_TOOL_STATUS: Record<string, string> = {
  dice: "正在判定骰子...",
  activateSystem: "正在激活系统...",
  reviewBranch: "正在审查大纲事实一致性...",
};

function hasCreateQuestionToolCall(
  toolCalls: Array<{ dynamic?: boolean; toolName: string }>,
) {
  return toolCalls.some(
    (toolCall) =>
      toolCall.dynamic !== true && toolCall.toolName === "createQuestion",
  );
}

export async function createStory(source: string, singularity: string) {
  const traceId = nanoid();
  const log = createLLMLogging({ traceId, action: "createStory" });

  log.info({ source, singularity }, "action.start");

  const session = await getSessionWithRedirect();

  const prompt = `# 故事设定\n\n## 故事来源\n${source}\n\n## 特异点\n${singularity}`;

  const chatId = nanoid();
  const storyId = nanoid();
  const messageId = nanoid();
  const now = new Date();

  await db.insert(chat).values({
    id: chatId,
    userId: session.user.id,
    title: source,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(story).values({
    id: storyId,
    chatId,
    source,
    singularity,
    createdAt: now,
    updatedAt: now,
  });

  const stream = createStreamableValue<UIMessageChunk | AgentStatusEvent>();
  (async () => {
    try {
      stream.update({
        type: "agent-status",
        agentId: "Archivist",
        statusText: AGENT_STATUS_TEXT.Archivist,
      });

      log.info("agent.Archivist.start");
      const result = await archivist.stream({
        prompt,
        experimental_context: {
          db,
          chatId,
          traceId,
          tokenUsage: createTokenAccumulator(),
        },
        onStepFinish(step) {
          log.step(step, "agent.Archivist.step.finish");
        },
        async onFinish(event) {
          log.finish(event, "agent.Archivist.finish");
          try {
            await saveMessageWithTool(
              messageId,
              event as unknown as OnFinishEvent<ToolSet>,
              { db, chatId, traceId },
            );
          } catch (error) {
            log.error({ error }, "message.save.failed");
          }
        },
        onError({ error }) {
          log.error({ error, agent: "archivist" }, "agent.stream.error");
          stream.update({ type: "agent-status", agentId: null });
        },
      });

      const uiMessages = result.toUIMessageStream();

      for await (const chunk of uiMessages) {
        stream.update(chunk);
      }

      stream.update({ type: "agent-status", agentId: null });
      stream.done();
    } catch (error) {
      log.error({ error }, "action.stream.failed");
      stream.update({ type: "agent-status", agentId: null });
      stream.error(error);
    }
  })();

  return {
    id: chatId,
    messageId: messageId,
    content: stream.value,
  };
}

async function continueCreateStory(
  chatId: string,
  messages: ModelMessage[],
  experimental_context: ToolContext,
  onFinish: (event: OnFinishEvent<ToolSet>) => Promise<void>,
  stream: StreamUpdater,
) {
  const log = createLLMLogging({
    traceId: experimental_context.traceId,
    action: "continueCreateStory",
    chatId,
  });

  stream.update({
    type: "agent-status",
    agentId: "Archivist",
    statusText: AGENT_STATUS_TEXT.Archivist,
  });
  log.info("agent.Archivist.start");

  const archivistResult = await archivist.stream({
    prompt: [
      {
        role: "user" as const,
        content:
          "请根据设定的故事背景、特异点以及用户回答，必要时继续向用户提问；信息完整后生成故事设定、角色设定，并初始化主角状态和任务状态。",
      },
      ...messages,
    ],
    experimental_context,
    stopWhen: [
      ({ steps }) => isArchivistInitComplete(steps),
      hasToolCall("createQuestion"),
      stepCountIs(20),
    ],
    onStepFinish(step) {
      log.step(step, "agent.Archivist.step.finish");
    },
    async onFinish(event) {
      log.finish(event, "agent.Archivist.finish");
      const allEventToolCalls = event.steps.flatMap((s) => s.toolCalls);
      if (hasCreateQuestionToolCall(allEventToolCalls)) {
        await Promise.all(experimental_context.pendingStateUpdates ?? []);
        await onFinish(event as unknown as OnFinishEvent<ToolSet>);
        return;
      }
      if (experimental_context.tokenUsage) {
        addUsage(experimental_context.tokenUsage, event.totalUsage);
      }
    },
    onError({ error }) {
      log.error({ error, agent: "archivist" }, "agent.stream.error");
      stream.update({ type: "agent-status", agentId: null });
    },
  });

  const steps = await archivistResult.steps;
  const allStepToolCalls = steps.flatMap((s) => s.toolCalls);

  // createQuestion → short-circuit (existing behavior)
  if (hasCreateQuestionToolCall(allStepToolCalls)) {
    return archivistResult;
  }

  // Post-completion validation: verify all required init tools were called
  const completedToolNames = new Set(
    steps
      .flatMap((s) => s.toolResults)
      .filter((r) => r.dynamic !== true)
      .map((r) => r.toolName),
  );
  const missing = missingInitToolNames(completedToolNames);
  if (missing.length > 0) {
    log.error(
      `Archivist initialization failed: missing required tools: ${missing.join(", ")}`,
    );
    throw new Error(
      `Archivist initialization failed: missing required tools: ${missing.join(", ")}`,
    );
  }

  // All required tools completed → proceed to Weaver
  stream.update({
    type: "agent-status",
    agentId: "Weaver",
    statusText: AGENT_STATUS_TEXT.Weaver,
  });
  log.info("agent.Weaver.start");

  return await weaver.stream({
    prompt: [
      ...(await archivistResult.response).messages,
      {
        role: "user",
        content:
          "根据故事世界观和背景生成故事开端。必须详细描写特异点的前因以及特异点是如何发生的。在描述的结尾自然的留一个扣子，让用户和这个世界进行交互！",
      },
    ],
    experimental_context,
    async onFinish(event) {
      log.finish(event, "agent.Weaver.finish");
      await Promise.all(experimental_context.pendingStateUpdates ?? []);
      await onFinish(event as unknown as OnFinishEvent<ToolSet>);
    },
    onError({ error }) {
      log.error({ error, agent: "weaver" }, "agent.stream.error");
      stream.update({ type: "agent-status", agentId: null });
    },
  });
}

/**
 * 主流程：Sentinel → Oracle → Arbiter(reviewBranch) → Weaver
 *
 * 1. Sentinel 审查用户输入 — 通过 judgeInput 工具给出 approve/reject 判定
 * 2. Oracle 根据审查后的输入生成分支剧情，并在最终输出前调用一次 reviewBranch 完成事实一致性审查
 * 3. Weaver 将历史年表扩写为小说正文
 */
async function continueStory(
  chatId: string,
  messages: ModelMessage[],
  experimental_context: ToolContext,
  onFinish: (event: OnFinishEvent<ToolSet>) => Promise<void>,
  stream: StreamUpdater,
) {
  const log = createLLMLogging({
    traceId: experimental_context.traceId,
    action: "continueStory",
    chatId,
  });

  const storyData = await db.query.story.findFirst({ where: { chatId } });
  const isUpdate = storyData?.worldSnapshot ? true : false;

  // Step 1: Sentinel 审查用户输入
  stream.update({
    type: "agent-status",
    agentId: "Sentinel",
    statusText: AGENT_STATUS_TEXT.Sentinel,
  });

  log.info("agent.Sentinel.start");

  const sentinelInputResult = await sentinel.stream({
    prompt: messages,
    experimental_context,
    async onFinish(event) {
      log.finish(event, "agent.Sentinel.finish");
      const hasJudgementReject = event.toolCalls.some(
        (tc) =>
          tc.dynamic !== true &&
          tc.toolName === "judgeInput" &&
          tc.input.decision === "reject",
      );
      if (hasJudgementReject) {
        await onFinish(event as unknown as OnFinishEvent<ToolSet>);
      } else {
        if (experimental_context.tokenUsage) {
          addUsage(experimental_context.tokenUsage, event.totalUsage);
        }
      }
    },
    onError({ error }) {
      log.error({ error, agent: "sentinel" }, "agent.stream.error");
      stream.update({ type: "agent-status", agentId: null });
    },
  });

  const judgement = (await sentinelInputResult.toolCalls).findLast(
    (tc) => tc.toolName === "judgeInput" && tc.dynamic !== true,
  );

  if (!judgement) {
    log.error("agent.Sentinel.judgement.missing");
    stream.update({ type: "agent-status", agentId: null });
    return sentinelInputResult;
  }

  if (judgement.input.decision === "reject") {
    log.info(
      { reason: judgement.input.content },
      "agent.Sentinel.judgement.reject",
    );
    stream.update({ type: "agent-status", agentId: null });
    return sentinelInputResult;
  }

  // Step 2: Oracle 根据审查后的输入生成分支
  stream.update({
    type: "agent-status",
    agentId: "Oracle",
    statusText: AGENT_STATUS_TEXT.Oracle,
  });
  log.info("agent.Oracle.start");
  const oraclePrompt = [
    ...messages.slice(0, -1),
    {
      role: "user",
      content: judgement.input.content,
    } as ModelMessage,
  ];

  const oracleResult = await oracle.stream({
    prompt: oraclePrompt,
    experimental_context,
    onStepFinish(step) {
      log.step(step, "agent.Oracle.step.finish");
      const toolName = step.toolCalls[0]?.toolName;
      if (toolName && ORACLE_TOOL_STATUS[toolName]) {
        stream.update({
          type: "agent-status",
          agentId: "Oracle",
          statusText: ORACLE_TOOL_STATUS[toolName],
        });
      }
    },
    onFinish(event) {
      if (experimental_context.tokenUsage) {
        addUsage(experimental_context.tokenUsage, event.totalUsage);
      }
    },
    onError({ error }) {
      log.error({ error, agent: "oracle" }, "agent.stream.error");
      stream.update({ type: "agent-status", agentId: null });
    },
  });

  const oracleText = await oracleResult.text;
  const oracleSteps = await oracleResult.steps;
  const reviewBranchCount = oracleSteps
    .flatMap((step) => step.toolCalls)
    .filter((toolCall) => toolCall.toolName === "reviewBranch").length;

  if (reviewBranchCount !== 1) {
    log.error({ reviewBranchCount }, "agent.Oracle.reviewBranch.count.invalid");
  }

  if (oracleText.length === 0) {
    log.error(
      { oracleResult: await oracleResult },
      "agent.Oracle.output.empty",
    );
    stream.update({ type: "agent-status", agentId: null });
    return oracleResult;
  }

  stream.update({
    type: "agent-status",
    agentId: "Weaver",
    statusText: AGENT_STATUS_TEXT.Weaver,
  });

  const latestMessage = await getLastestChatMessage(chatId);
  const weaverContent =
    "根据最新章节大纲完成小说内容 \n\n" +
    (latestMessage?.text
      ? "1. 正文需要保持和之前正文的连贯性和一致性. 2.参考之前的历史记录和世界背景，防止出现内容冲突内容。 \n\n" +
        `##上一章节正文 \n\n` +
        `${latestMessage.text} \n\n`
      : "1. 参考之前的历史记录和世界背景，防止出现内容冲突内容。 \n\n") +
    `##最新章节大纲 \n\n` +
    `${oracleText}`;

  log.debug("weaverContent: \n\n" + weaverContent);

  const result = await weaver.stream({
    prompt: [
      ...messages.slice(0, 2),
      {
        role: "user",
        content: weaverContent,
      },
    ],
    experimental_context,
    onAbort(event) {
      log.info(event, "agent.Weaver.abort");
      stream.update({ type: "agent-status", agentId: null });
    },
    onError({ error }) {
      log.error({ error, agent: "weaver" }, "agent.stream.error");
      stream.update({ type: "agent-status", agentId: null });
    },
    async onFinish(options) {
      log.finish(options, "agent.Weaver.finish");
      const now = new Date();
      await db.insert(history).values({
        id: nanoid(),
        chatId: chatId,
        content: oracleText,
        createdAt: now,
      });
      await Promise.all(experimental_context.pendingStateUpdates ?? []);
      await onFinish(options as unknown as OnFinishEvent<ToolSet>);
    },
  });

  stream.update({
    type: "agent-status",
    agentId: "Statekeeper",
    statusText: AGENT_STATUS_TEXT.Statekeeper,
  });

  const stateResult = statekeeper.generate({
    prompt: [
      ...messages.slice(0, -1),
      {
        role: "user",
        content: isUpdate
          ? `当前已存在旧的主角五维和世界快照。请根据大纲更新主角五维数值和世界当前快照。\n\n：${oracleText}`
          : `当前没有旧的主角五维或世界快照。请根据故事设定初始化主角五维和世界当前快照。\n\n：${oracleText}`,
      },
    ],
    experimental_context,
    onStepFinish(step) {
      log.step(step, "agent.Statekeeper.step.finish");
    },
  });

  const taskResult = taskmaster.generate({
    prompt: [
      ...messages.slice(0, -1),
      {
        role: "user",
        content: isUpdate
          ? `当前已存在旧的任务状态。请根据大纲更新任务列表。\n\n：${oracleText}`
          : `当前没有旧的任务状态。请根据故事设定初始化任务系统，允许暂无任务。\n\n：${oracleText}`,
      },
    ],
    experimental_context,
    onStepFinish(step) {
      log.step(step, "agent.taskmaster.step.finish");
    },
  });

  Promise.all([stateResult, taskResult]).then(([stateResult, taskResult]) => {
    if (experimental_context.tokenUsage) {
      addUsage(experimental_context.tokenUsage, stateResult.totalUsage);
      addUsage(experimental_context.tokenUsage, taskResult.totalUsage);
    }
  });

  return result;
}

export async function continueConversation(chatId: string, prompt: string) {
  if (prompt.trim().length === 0) {
    throw new InvalidInputError({ message: "input is empty!" });
  }
  const traceId = nanoid();
  const log = createLLMLogging({ traceId, action: "continueConversation" });
  const userMessageId = nanoid();
  const assistantMessageId = nanoid();

  const now = new Date();

  const session = await getSessionWithRedirect();
  await ensureChatAccess(chatId, session.user.id);

  log.info({ chatId, prompt }, "action.input");

  const history = await getChatHistory(chatId, 5);
  const storyData = await db.query.story.findFirst({
    where: { chatId: chatId },
  });
  const protagonistData = await db.query.protagonistState.findFirst({
    where: { chatId },
  });
  const latestMessage = await getLastestChatMessage(chatId);

  const recentQuestion =
    latestMessage &&
    "toolCalls" in latestMessage &&
    latestMessage.toolCalls?.find(
      (tc) => tc.name === "createQuestion" && !tc.result,
    );

  let latestModelMessages: MessageWithToolCall | NewMessage | undefined =
    latestMessage;
  if (recentQuestion) {
    recentQuestion.result = prompt;
  } else {
    latestModelMessages = {
      id: userMessageId,
      chatId,
      role: "user" as const,
      text: prompt,
      createdAt: now,
    };
  }

  const isSettingComplete =
    storyData?.type && storyData?.worldview && storyData?.worldSnapshot;

  const questionMessages = isSettingComplete
    ? []
    : (await getChatQuestions(chatId, 10)).map((message) =>
        recentQuestion && message.id === latestMessage?.id
          ? latestMessage
          : message,
      );

  const storyMessage = toStoryModelMessage(storyData);
  const runtimeMessage = toRuntimeStateModelMessage({
    story: storyData,
    protagonistState: protagonistData,
  });
  const historyMessage = toHistoryModelMessage(history);
  const latestInputMessage = isSettingComplete
    ? toModelMessage(latestModelMessages)
    : [
        ...toModelMessages(questionMessages),
        ...(recentQuestion ? [] : toModelMessage(latestModelMessages)),
      ];
  const modelMessage = [
    storyMessage,
    runtimeMessage,
    historyMessage,
    ...latestInputMessage,
  ].filter((m) => m !== undefined);

  const contextTokens = estimateModelMessageTokens(modelMessage);

  log.debug(
    { inputMessages: modelMessage, contextTokens },
    "action.model-message.input",
  );

  const stream = createStreamableValue<UIMessageChunk | AgentStatusEvent>();

  (async () => {
    const experimental_context = {
      db,
      chatId,
      traceId,
      tokenUsage: createTokenAccumulator(),
    };
    const onFinish = async (
      event: Parameters<typeof saveMessageWithTool>[1],
    ) => {
      try {
        if (recentQuestion) {
          await db
            .update(toolCall)
            .set({ result: prompt })
            .where(eq(toolCall.id, recentQuestion.id));
        } else {
          await db.insert(message).values({
            id: userMessageId,
            chatId,
            role: "user" as const,
            text: prompt,
            createdAt: now,
          });
        }
        await db
          .update(chat)
          .set({ updatedAt: new Date() })
          .where(eq(chat.id, chatId));
        await saveMessageWithTool(assistantMessageId, event, {
          db,
          chatId,
          traceId,
          tokenUsage: experimental_context.tokenUsage,
        });
      } catch (error) {
        log.error({ error }, "action.finish.failed");
      }
    };

    try {
      const result = isSettingComplete
        ? await continueStory(
            chatId,
            modelMessage,
            experimental_context,
            onFinish,
            stream,
          )
        : await continueCreateStory(
            chatId,
            modelMessage,
            experimental_context,
            onFinish,
            stream,
          );

      const uiMessages = result.toUIMessageStream();

      for await (const chunk of uiMessages) {
        stream.update(chunk);
      }

      stream.update({ type: "agent-status", agentId: null });
      stream.done();
    } catch (error) {
      log.error({ error, modelMessage }, "action.stream.failed");
      stream.update({ type: "agent-status", agentId: null });
      stream.error(error);
    }
  })();

  return {
    id: chatId,
    messageId: assistantMessageId,
    content: stream.value,
  };
}
