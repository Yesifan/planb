"use client";

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
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useStory } from "@/hooks/use-story";
import { formatRelativeTime } from "@/lib/utils";

import StorySetting from "./story-setting";

export default function ConversationView({ chatId }: { chatId: string }) {
  const [input, setInput] = useState("");
  const { messages, chat, story, isLoading, error, sendMessage } =
    useStory(chatId);

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <Spinner className="size-8" />
        <span className="text-muted-foreground">加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>加载失败</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div className="flex flex-col">
            <h1 className="font-heading truncate text-lg font-semibold">
              {chat?.title || "未命名对话"}
            </h1>
            <div className="text-muted-foreground mt-1 flex gap-4 text-xs">
              {chat?.createdAt && (
                <span className="inline-flex items-center gap-1">
                  <span>创建: {formatRelativeTime(chat.createdAt)}</span>
                </span>
              )}
              {chat?.updatedAt && (
                <span className="inline-flex items-center gap-1">
                  <span>更新: {formatRelativeTime(chat.updatedAt)}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <StorySetting story={story} />

      <div className="flex flex-1 flex-col">
        <Conversation className="flex-1 p-6">
          <ConversationContent>
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={<MessageSquare className="size-12" />}
                title="开始对话"
                description="在下方输入消息开始聊天"
              />
            ) : (
              messages.map((message) => (
                <Message from={message.role} key={message.id}>
                  <MessageContent>
                    {message.parts.map((part, i) => {
                      switch (part.type) {
                        case "text":
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
        <PromptInput onSubmit={sendMessage} className="relative mx-auto w-full">
          <PromptInputTextarea
            value={input}
            placeholder="说点什么..."
            onChange={(e) => setInput(e.currentTarget.value)}
            className="pr-12"
          />
          <PromptInputSubmit
            disabled={!input.trim()}
            className="absolute right-1 bottom-1"
          />
        </PromptInput>
      </div>
    </div>
  );
}
