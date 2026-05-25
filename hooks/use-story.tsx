"use client";

import { nanoid } from "nanoid";
import { useParams, useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { getChatMessages, getChatWithStory } from "@/lib/actions/db";
import {
  continueConversation,
  createStory as createStoryAction,
  retryLastGeneration,
} from "@/lib/actions/llm";
import type { Chat, Story } from "@/lib/db/schema";
import { streamToUIMessage } from "@/lib/llm/client";
import { MyUIMessage } from "@/lib/llm/type";
import { toUIMessages } from "@/lib/llm/utils";
import logger from "@/lib/logger";
export interface UseStoryReturn {
  chatId?: string;
  chat?: Chat;
  story?: Story;
  messages: MyUIMessage[];
  streamingMessage: MyUIMessage | null;
  isLoading: boolean;
  isStreaming: boolean;
  agentStatus: { agentId: string; statusText: string } | null;
  error?: string;
  createStory: (source: string, singularity: string) => Promise<string>;
  sendMessage: (message: PromptInputMessage) => Promise<void>;
  retryGeneration: () => Promise<void>;
}

const StoryContext = createContext<UseStoryReturn | null>(null);

export function StoryProvider({ children }: { children: ReactNode }) {
  const params = useParams<{ chat?: string[] }>();
  const chatId = params.chat?.[0];
  const router = useRouter();

  const skipFetchMessage = useRef<string | undefined>(undefined);
  const [messages, setMessages] = useState<MyUIMessage[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<MyUIMessage | null>(null);
  const [chat, setChat] = useState<Chat | undefined>(undefined);
  const [story, setStory] = useState<Story | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentStatus, setAgentStatus] = useState<{ agentId: string; statusText: string } | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!chatId) {
      setChat(undefined);
      setStory(undefined);
      return;
    }

    getChatWithStory(chatId).then((chat) => {
      setChat(chat);
      if (chat.story) setStory(chat.story);
    });
  }, [chatId]);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }
    if (chatId === skipFetchMessage.current) {
      return;
    }

    setIsLoading(true);
    setError(undefined);
    getChatMessages(chatId).then((dbMessages) => {
      const uiMessage = toUIMessages(dbMessages);
      logger.debug(uiMessage, "use story effect");
      setMessages(uiMessage);
      setIsLoading(false);
    });
  }, [chatId]);

  const createStory: UseStoryReturn["createStory"] = useCallback(
    async (source, singularity) => {
      setIsStreaming(true);
      try {
        const {
          id,
          messageId,
          content: newMessage,
        } = await createStoryAction(source, singularity);

        let finalMessage: MyUIMessage | null = null;

        for await (const uiMessage of streamToUIMessage(messageId, newMessage)) {
          if (uiMessage.agentStatus !== undefined) {
            setAgentStatus(uiMessage.agentStatus);
          }
          setStreamingMessage(uiMessage);
          finalMessage = uiMessage;
        }

        if (finalMessage) {
          setMessages((prev) => [...prev, finalMessage!]);
        }
        setStreamingMessage(null);

        skipFetchMessage.current = id;
        router.push(`/story/${id}`);
        return id;
      } finally {
        setIsStreaming(false);
        setAgentStatus(null);
      }
    },
    [router],
  );

  const sendMessage = useCallback(
    async (message: PromptInputMessage) => {
      if (!chatId) return;

      logger.info({ chatId, message }, "sendMessage");

      const userMsg: MyUIMessage = {
        id: nanoid(),
        role: "user",
        parts: [{ type: "text", text: message.text }],
      };

      setMessages((prev) => [...prev, userMsg]);

      setIsStreaming(true);
      try {
        const { messageId, content: newMessage } = await continueConversation(
          chatId,
          message.text,
        );

        let finalMessage: MyUIMessage | null = null;

        for await (const uiMessage of streamToUIMessage(messageId, newMessage)) {
          if (uiMessage.agentStatus !== undefined) {
            setAgentStatus(uiMessage.agentStatus);
          }
          setStreamingMessage(uiMessage);
          finalMessage = uiMessage;
        }

        if (finalMessage) {
          setMessages((prev) => [...prev, finalMessage!]);
        }
        setStreamingMessage(null);

        const updatedChat = await getChatWithStory(chatId);
        if (updatedChat.story) {
          setStory(updatedChat.story);
        }
      } catch (e) {
        logger.error({ err: e }, "sendMessage failed");
        toast.error("生成失败,可点击重试");
        setStreamingMessage(null);
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      } finally {
        setIsStreaming(false);
        setAgentStatus(null);
      }
    },
    [chatId],
  );

  const retryGeneration: UseStoryReturn["retryGeneration"] = useCallback(
    async () => {
      if (!chatId) return;

      setIsStreaming(true);
      try {
        const { messageId, content: newMessage } =
          await retryLastGeneration(chatId);

        let finalMessage: MyUIMessage | null = null;

        for await (const uiMessage of streamToUIMessage(messageId, newMessage)) {
          if (uiMessage.agentStatus !== undefined) {
            setAgentStatus(uiMessage.agentStatus);
          }
          setStreamingMessage(uiMessage);
          finalMessage = uiMessage;
        }

        if (finalMessage) {
          setMessages((prev) => [...prev, finalMessage!]);
        }
        setStreamingMessage(null);

        const updatedChat = await getChatWithStory(chatId);
        if (updatedChat.story) {
          setStory(updatedChat.story);
        }
      } catch (e) {
        logger.error({ err: e }, "retryGeneration failed");
        toast.error("重试失败,请稍后再试");
        setStreamingMessage(null);
      } finally {
        setIsStreaming(false);
        setAgentStatus(null);
      }
    },
    [chatId],
  );

  return (
    <StoryContext.Provider
      value={{
        chatId,
        messages,
        streamingMessage,
        chat,
        story,
        isLoading,
        isStreaming,
        agentStatus,
        error,
        createStory,
        sendMessage,
        retryGeneration,
      }}
    >
      {children}
    </StoryContext.Provider>
  );
}

export function useStoryContext(): UseStoryReturn {
  const context = useContext(StoryContext);
  if (!context) {
    throw new Error("useStoryContext must be used within a StoryProvider");
  }
  return context;
}
