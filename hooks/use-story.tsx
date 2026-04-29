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

import { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { getChatMessages, getChatWithStory } from "@/lib/actions/db";
import {
  continueConversation,
  createStory as createStoryAction,
} from "@/lib/actions/llm";
import type { Chat, Story } from "@/lib/db/schema";
import { MyUIMessage } from "@/lib/llm/type";
import { streamToUIMessage, toUIMessages } from "@/lib/llm/utils";

export interface UseStoryReturn {
  chatId?: string;
  chat?: Chat;
  story?: Story;
  messages: MyUIMessage[];
  isLoading: boolean;
  error?: string;
  createStory: (source: string, singularity: string) => Promise<string>;
  sendMessage: (message: PromptInputMessage) => Promise<void>;
}

const StoryContext = createContext<UseStoryReturn | null>(null);

export function StoryProvider({ children }: { children: ReactNode }) {
  const params = useParams<{ chat?: string[] }>();
  const chatId = params.chat?.[0];
  const router = useRouter();

  const skipFetchMessage = useRef<string | undefined>(undefined);
  const [messages, setMessages] = useState<MyUIMessage[]>([]);
  const [chat, setChat] = useState<Chat | undefined>(undefined);
  const [story, setStory] = useState<Story | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
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
      setMessages(toUIMessages(dbMessages));
      setIsLoading(false);
    });
  }, [chatId]);

  const createStory: UseStoryReturn["createStory"] = useCallback(
    async (source, singularity) => {
      const {
        id,
        messageId,
        content: newMessage,
      } = await createStoryAction(source, singularity);

      for await (const uiMessage of streamToUIMessage(messageId, newMessage)) {
        setMessages((prev) => {
          const without = prev.filter((m) => m.id !== messageId);
          return [...without, uiMessage];
        });
      }

      skipFetchMessage.current = id;
      router.push(`/story/${id}`);
      return id;
    },
    [router],
  );

  const sendMessage = useCallback(
    async (message: PromptInputMessage) => {
      if (!chatId) return;

      const userMsg: MyUIMessage = {
        id: nanoid(),
        role: "user",
        parts: [{ type: "text", text: message.text }],
      };

      setMessages((prev) => [...prev, userMsg]);

      const { content: newMessage } = await continueConversation(
        chatId,
        message.text,
      );

      const messageId = nanoid();

      for await (const uiMessage of streamToUIMessage(messageId, newMessage)) {
        setMessages((prev) => {
          const without = prev.filter((m) => m.id !== messageId);
          return [...without, uiMessage];
        });
      }

      // Refresh story state after stream completes (story settings may have been updated)
      const updatedChat = await getChatWithStory(chatId);
      if (updatedChat.story) {
        setStory(updatedChat.story);
      }
    },
    [chatId],
  );

  return (
    <StoryContext.Provider
      value={{
        chatId,
        messages,
        chat,
        story,
        isLoading,
        error,
        createStory,
        sendMessage,
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
