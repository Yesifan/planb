"use client";

import { useMemo, useState } from "react";
import z from "zod";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ChatRightSidebar } from "@/components/chat-right-sidebar";
import CreateStoryForm, {
  createStoryFormSchema,
} from "@/components/create-story-form";
import StoryHeader from "@/components/story-header";
import {
  StoryPrompt,
  StoryPromptInput,
  StoryPromptSubmit,
} from "@/components/story-prompt";
import StoryQuestion from "@/components/story-question";
import StoryRejection from "@/components/story-rejection";
import StorySetting from "@/components/story-setting";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { useStoryContext } from "@/hooks/use-story";
import { useStoryLayout } from "@/hooks/use-story-layout";
import type { CreateQuestion } from "@/lib/llm/tool";

export default function StoryPage() {
  const [input, setInput] = useState("");
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const {
    chatId,
    messages,
    streamingMessage,
    chat,
    story,
    isLoading,
    isStreaming,
    error,
    createStory,
    sendMessage,
    agentStatus,
  } = useStoryContext();
  const { refreshChatList } = useStoryLayout();

  const latestMessage = useMemo(
    () =>
      streamingMessage ??
      (messages.length > 0 ? messages[messages.length - 1] : undefined),
    [messages, streamingMessage],
  );
  const latestPart = useMemo(() => {
    if (latestMessage?.parts && latestMessage.parts.length > 0) {
      return latestMessage.parts[latestMessage.parts.length - 1];
    }
  }, [latestMessage]);

  const question = useMemo(() => {
    if (
      latestPart &&
      latestPart.type === "tool-createQuestion" &&
      !latestPart.output
    ) {
      return latestPart.input as CreateQuestion;
    }
  }, [latestPart]);

  const onCreate = async (values: z.infer<typeof createStoryFormSchema>) => {
    await createStory(values.source, values.singularity);
    refreshChatList();
  };

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {!chatId && <CreateStoryForm onSubmit={onCreate} />}
      {isLoading && (
        <div className="flex h-screen flex-col items-center justify-center gap-4">
          <Spinner className="size-8" />
          <span className="text-muted-foreground">加载中...</span>
        </div>
      )}
      {error && (
        <div className="flex h-screen flex-col items-center justify-center p-6">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>加载失败</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-muted-foreground">{error}</p>
            </CardContent>
          </Card>
        </div>
      )}
      {chatId && !isLoading && !error && (
        <>
          <StoryHeader chat={chat} />
          <SidebarProvider
            open={isRightSidebarOpen}
            onOpenChange={setIsRightSidebarOpen}
            defaultOpen={false}
            className="contents"
          >
            <StorySetting story={story} />

            <div className="relative flex min-h-0 flex-1 overflow-hidden">
              <div className="relative flex min-w-0 flex-1 flex-col">
                <Conversation className="flex-1">
                  <ConversationContent className="w-full md:w-3xl">
                    {messages.map((message) => (
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
                              case "tool-judgeInput":
                                return part.input?.decision === "reject" ? (
                                  <StoryRejection
                                    key={`${message.id}-${i}`}
                                    reason={part.input?.content ?? ""}
                                  />
                                ) : null;
                            }
                          })}
                        </MessageContent>
                      </Message>
                    ))}
                    {isStreaming && (
                      <>
                        <Shimmer key={agentStatus?.agentId ?? "shimmer"}>
                          {agentStatus?.statusText ?? "思考中..."}
                        </Shimmer>
                        {streamingMessage && (
                          <Message
                            from={streamingMessage.role}
                            key={streamingMessage.id}
                          >
                            <MessageContent>
                              {streamingMessage.parts.map((part, i) => {
                                switch (part.type) {
                                  case "text":
                                    return (
                                      <MessageResponse
                                        key={`${streamingMessage.id}-${i}`}
                                      >
                                        {part.text}
                                      </MessageResponse>
                                    );
                                  case "tool-judgeInput":
                                    return part.input?.decision ===
                                      "reject" ? (
                                      <StoryRejection
                                        key={`${streamingMessage.id}-${i}`}
                                        reason={part.input?.content ?? ""}
                                      />
                                    ) : null;
                                }
                              })}
                            </MessageContent>
                          </Message>
                        )}
                      </>
                    )}
                  </ConversationContent>
                  <ConversationScrollButton />
                </Conversation>
                {question ? (
                  <StoryQuestion
                    question={question}
                    onSubmit={sendMessage}
                    className="my-4"
                  />
                ) : (
                  <StoryPrompt
                    input={input}
                    onInputChange={setInput}
                    onSubmit={sendMessage}
                    disabled={isStreaming}
                    className="relative mx-auto w-full"
                  >
                    <StoryPromptInput placeholder="说点什么..." />
                    <StoryPromptSubmit
                      status={isStreaming ? "streaming" : undefined}
                    />
                  </StoryPrompt>
                )}
              </div>
              <ChatRightSidebar chatId={chatId} isStreaming={isStreaming} />
            </div>
          </SidebarProvider>
        </>
      )}
    </div>
  );
}
