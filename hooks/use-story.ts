"use client";

import { readStreamableValue } from "@ai-sdk/rsc";
import type { UIMessage } from "ai";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useState } from "react";

import { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { getChatMessages, getChatWithStory } from "@/lib/actions/db";
import {
  continueConversation,
  createStory as createStoryAction,
} from "@/lib/actions/llm";
import type { Chat, Message, Story } from "@/lib/db/schema";

export interface UseStoryReturn {
  chat?: Chat;
  story?: Story;
  messages: UIMessage[];
  isLoading: boolean;
  error?: string;
  retry: () => void;
  createStory: typeof createStoryAction;
  sendMessage: (message: PromptInputMessage) => Promise<void>;
}

function toUIMessages(dbMessages: Message[]): UIMessage[] {
  return dbMessages
    .filter((m) => m.role !== "system" && m.role !== "tool")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      parts: [{ type: "text" as const, text: m.text }],
    }));
}

export function useStory(chatId?: string): UseStoryReturn {
  const [messages, setMessages] = useState<UIMessage[]>([]);

  const [chat, setChat] = useState<Chat | undefined>(undefined);
  const [story, setStory] = useState<Story | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const createStory: typeof createStoryAction = async (source, singularity) => {
    const result = await createStoryAction(source, singularity);
    // router.push(`/story/${result.id}`, { scroll: false });
    window.history.pushState(null, "", `/story/${result.id}`);
    return result;
  };

  const loadData = useCallback(async () => {
    if (!chatId) return;

    try {
      setIsLoading(true);
      setError(undefined);

      const [chatWithStory, dbMessages] = await Promise.all([
        getChatWithStory(chatId),
        getChatMessages(chatId),
      ]);

      if (chatWithStory) {
        setChat(chatWithStory.chat);
        setStory(chatWithStory.story);
      } else {
        setError("Chat not found");
        return;
      }

      if (dbMessages.length > 0) {
        setMessages(toUIMessages(dbMessages));
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load chat");
    } finally {
      setIsLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    loadData();
  }, []);

  const sendMessage = async (message: PromptInputMessage) => {
    if (chatId) {
      const userMsg: UIMessage = {
        id: nanoid(),
        role: "user",
        parts: [{ type: "text", text: message.text }],
      };

      setMessages((prev) => [...prev, userMsg]);

      const newMessage = await continueConversation(chatId, message.text);

      let textContent = "";
      const assistantId = nanoid();

      for await (const delta of readStreamableValue(newMessage)) {
        textContent = `${textContent}${delta}`;

        setMessages((prev) => {
          const withoutLast = prev.filter((m) => m.id !== assistantId);
          return [
            ...withoutLast,
            {
              id: assistantId,
              role: "assistant" as const,
              parts: [{ type: "text" as const, text: textContent }],
            },
          ];
        });
      }
    }
  };

  return {
    messages,
    chat,
    story,
    isLoading,
    error,
    retry: loadData,
    createStory,
    sendMessage,
  };
}
