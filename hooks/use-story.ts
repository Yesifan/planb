"use client";

import { nanoid } from "nanoid";
import { useEffect, useState } from "react";

import { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { getChatMessages, getChatWithStory } from "@/lib/actions/db";
import {
  continueConversation,
  createStory as createStoryAction,
} from "@/lib/actions/llm";
import type { Chat, Story } from "@/lib/db/schema";
import { MyUIMessage } from "@/lib/llm/type";
import { streamToUIMessage, toUIMessages } from "@/lib/llm/utils";
import logger from "@/lib/logger";

export interface UseStoryReturn {
  chat?: Chat;
  story?: Story;
  messages: MyUIMessage[];
  isLoading: boolean;
  error?: string;
  createStory: (source: string, singularity: string) => Promise<string>;
  sendMessage: (message: PromptInputMessage) => Promise<void>;
}

export function useStory(chatId?: string): UseStoryReturn {
  const [messages, setMessages] = useState<MyUIMessage[]>([]);

  const [chat, setChat] = useState<Chat | undefined>(undefined);
  const [story, setStory] = useState<Story | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const createStory: UseStoryReturn["createStory"] = async (
    source,
    singularity,
  ) => {
    const {
      id,
      messageId,
      content: newMessage,
    } = await createStoryAction(source, singularity);
    window.history.pushState(null, "", `/story/${id}`);

    for await (const uiMessage of streamToUIMessage(messageId, newMessage)) {
      logger.debug(uiMessage, "createStory uiMessage");
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== messageId);
        return [...without, uiMessage];
      });
    }

    return id;
  };

  useEffect(() => {
    if (!chatId) return;

    setIsLoading(true);
    setError(undefined);

    (async () => {
      try {
        const [chat, message] = await Promise.all([
          getChatWithStory(chatId),
          getChatMessages(chatId),
        ]);
        logger.debug(message, "dbMessages");

        setChat(chat);
        if (chat.story) {
          setStory(chat.story);
        }

        setMessages(toUIMessages(message));
      } catch (err) {
        logger.error(err, "useStory load data");
        setError(err instanceof Error ? err.message : "Failed to load chat");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const sendMessage = async (message: PromptInputMessage) => {
    if (chatId) {
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
    }
  };

  return {
    messages,
    chat,
    story,
    isLoading,
    error,
    createStory,
    sendMessage,
  };
}
