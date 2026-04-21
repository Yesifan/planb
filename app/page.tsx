"use client";

import { useChat } from "@ai-sdk/react";
import { readStreamableValue } from "@ai-sdk/rsc";
import { UIMessage } from "ai";
import { MessageSquare } from "lucide-react";
import { useState } from "react";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { continueConversation } from "@/lib/actions/llm";

const ConversationDemo = () => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<UIMessage[]>([]);

  const handleSubmit = async (message: PromptInputMessage) => {
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

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="flex h-full flex-1 flex-col">
        <Conversation className="p-6">
          <ConversationContent>
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={<MessageSquare className="size-12" />}
                title="Start a conversation"
                description="Type a message below to begin chatting"
              />
            ) : (
              messages.map((message) => (
                <Message from={message.role} key={message.id}>
                  <MessageContent>
                    {message.parts.map((part, i) => {
                      switch (part.type) {
                        case "text": // we don't use any reasoning or tool calls in this example
                          return (
                            <MessageResponse key={`${message.id}-${i}`}>
                              {part.text}
                            </MessageResponse>
                          );
                        default:
                          return null;
                      }
                    })}
                  </MessageContent>
                </Message>
              ))
            )}
          </ConversationContent>

          <ConversationScrollButton />
        </Conversation>

        <PromptInput
          onSubmit={handleSubmit}
          className="relative mx-auto w-full"
        >
          <PromptInputTextarea
            value={input}
            placeholder="Say something..."
            onChange={(e) => setInput(e.currentTarget.value)}
            className="pr-12"
          />
          <PromptInputSubmit
            // status={status === "streaming" ? "streaming" : "ready"}
            disabled={!input.trim()}
            className="absolute right-1 bottom-1"
          />
        </PromptInput>
      </div>
    </div>
  );
};

export default ConversationDemo;
