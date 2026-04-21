"use client";

import { readStreamableValue } from "@ai-sdk/rsc";
import { UIMessage } from "ai";
import { useState } from "react";

import { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { continueConversation } from "@/lib/actions/llm";

export function useStory() {
  const [messages, setMessages] = useState<UIMessage[]>([]);

  const sendMessage = async (message: PromptInputMessage) => {
    const newMessage = await continueConversation(message.text, { chatId: "" });

    let textContent = "";

    for await (const delta of readStreamableValue(newMessage)) {
      textContent = `${textContent}${delta}`;

      setMessages([
        {
          id: "1",
          role: "user",
          parts: [{ type: "text", text: message.text }],
        },
        {
          id: "",
          role: "assistant",
          parts: [{ type: "text", text: textContent }],
        },
      ]);
    }
  };

  return {
    messages,
    sendMessage,
  };
}
