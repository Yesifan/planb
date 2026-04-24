"use client";

import { MessageSquare, RotateCw } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import z from "zod";

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
import StorySetting from "@/components/story-setting";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useStory } from "@/hooks/use-story";
import type { CreateQuestion } from "@/lib/llm/tool";

export default function StoryPage() {
  const params = useParams<{ chat?: string[] }>();
  const chatId = params.chat?.[0];
  const [question, setQuestion] = useState<CreateQuestion | undefined>();

  const [input, setInput] = useState("");
  const {
    messages,
    chat,
    story,
    isLoading,
    error,
    retry,
    createStory,
    sendMessage,
  } = useStory(chatId);

  const onCreate = async (values: z.infer<typeof createStoryFormSchema>) => {
    const { toolCalls } = await createStory(values.source, values.singularity);
    const questionToolCall = toolCalls
      .filter((tool) => !tool.dynamic)
      .find((tool) => tool.toolName === "createQuestion");
    if (questionToolCall) {
      setQuestion(questionToolCall.input);
    }
  };

  if (!chatId) {
    return <CreateStoryForm onSubmit={onCreate} />;
  }

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
      <StoryHeader chat={chat} />

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
        {question ? (
          <StoryQuestion
            question={question}
            onSubmit={async (message) => {
              await sendMessage(message);
              setQuestion(undefined);
            }}
            className="my-4"
          />
        ) : (
          <StoryPrompt
            input={input}
            onInputChange={setInput}
            onSubmit={sendMessage}
            className="relative mx-auto w-full"
          >
            <StoryPromptInput placeholder="说点什么..." />
            <StoryPromptSubmit />
          </StoryPrompt>
        )}
      </div>
    </div>
  );
}
