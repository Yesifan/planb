"use client";

import { readStreamableValue } from "@ai-sdk/rsc";
import type { UIMessage } from "ai";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useState } from "react";

import { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { getChatMessages, getChatWithStory } from "@/lib/actions/db";
import { continueConversation } from "@/lib/actions/llm";
import type { Chat, Message, Story } from "@/lib/db/schema";

export interface UseStoryReturn {
  chat: Chat | null;
  story: Story | null;
  messages: UIMessage[];
  isLoading: boolean;
  error: string | null;
  retry: () => void;
  sendMessage: (message: PromptInputMessage) => Promise<void>;
}

function toUIMessages(dbMessages: Message[]): UIMessage[] {
  return dbMessages
    .filter((m) => m.role !== "system" && m.role !== "tool")
    .map((m, i) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      parts: [{ type: "text" as const, text: m.content }],
    }));
}

export function useStory(chatId: string): UseStoryReturn {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [story, setStory] = useState<Story | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!chatId?.trim()) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    try {
      setIsLoading(true);
      setError(null);

      const [chatWithStory, dbMessages] = await Promise.all([
        getChatWithStory(chatId),
        getChatMessages(chatId),
      ]);

      if (!isMounted) return;

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
      if (isMounted) {
        setError(err instanceof Error ? err.message : "Failed to load chat");
      }
    } finally {
      if (isMounted) setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [chatId]);

  useEffect(() => {
    const cleanup = loadData();
    return () => {
      cleanup.then((fn) => fn?.());
    };
  }, [loadData]);

  const sendMessage = async (message: PromptInputMessage) => {
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
  };

  return {
    messages,
    chat,
    story,
    isLoading,
    error,
    retry: loadData,
    sendMessage,
  };
}
