"use client";

import {
  BookOpen,
  ChevronDown,
  Globe,
  MessageSquare,
  RotateCw,
  ScrollText,
  Sparkles,
  Tag,
} from "lucide-react";
import { useParams } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import { useStory } from "@/hooks/use-story";

const formatRelativeTime = (date: Date | number | null | undefined): string => {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 30) return `${diffDay}天前`;
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
};

const StoryPage = () => {
  const [input, setInput] = useState("");
  const params = useParams<{ chat: string }>();
  const { messages, chat, story, isLoading, error, retry, sendMessage } =
    useStory(params.chat);

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
          <CardContent className="flex flex-col gap-4">
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={retry} className="w-full">
              <RotateCw className="mr-2 size-4" />
              重试
            </Button>
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

      <Collapsible defaultOpen={false} className="border-b">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="group flex h-auto items-center gap-2 px-0"
            >
              <span className="font-heading text-sm font-medium">故事设定</span>
              <ChevronDown className="size-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            {story ? (
              <div className="bg-muted/30 rounded-xl p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <BookOpen className="text-accent mt-0.5 size-4" />
                      <div>
                        <div className="text-muted-foreground text-xs font-medium">
                          故事来源
                        </div>
                        <div className="text-sm">{story.source}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Sparkles className="text-accent mt-0.5 size-4" />
                      <div>
                        <div className="text-muted-foreground text-xs font-medium">
                          特异点
                        </div>
                        <div className="text-sm">{story.singularity}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Tag className="text-accent mt-0.5 size-4" />
                      <div>
                        <div className="text-muted-foreground text-xs font-medium">
                          类型
                        </div>
                        <div className="text-sm">{story.type}</div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Globe className="text-accent mt-0.5 size-4" />
                      <div>
                        <div className="text-muted-foreground text-xs font-medium">
                          世界观
                        </div>
                        <div className="text-sm">{story.worldview}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <ScrollText className="text-accent mt-0.5 size-4" />
                      <div>
                        <div className="text-muted-foreground text-xs font-medium">
                          描述
                        </div>
                        <div className="text-sm">{story.describe}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-muted/10 text-muted-foreground rounded-xl p-4 text-center text-sm">
                暂无故事设定
              </div>
            )}
          </CollapsibleContent>
        </div>
      </Collapsible>

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
};

export default StoryPage;
