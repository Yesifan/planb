"use client";

import { useParams } from "next/navigation";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useStory } from "@/hooks/use-story";
import type { CreateQuestion } from "@/lib/llm/tool";
import logger from "@/lib/logger";

export default function StoryPage() {
  const params = useParams<{ chat?: string[] }>();
  const _chatId = params.chat?.[0];

  const [chatId, setChatId] = useState<string | undefined>(_chatId);
  // const [question, setQuestion] = useState<CreateQuestion | undefined>();
  const [input, setInput] = useState("");
  const { messages, chat, story, isLoading, error, createStory, sendMessage } =
    useStory(chatId);

  const question = useMemo(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];

      if (lastMessage.parts.length > 0) {
        const lastPart = lastMessage.parts[lastMessage.parts.length - 1];
        if (lastPart.type === "tool-createQuestion" && !lastPart.output) {
          logger.debug(lastPart, "create question");

          return lastPart.input as CreateQuestion;
        }
      }
      return undefined;
    }
  }, [messages]);

  const onCreate = async (values: z.infer<typeof createStoryFormSchema>) => {
    const id = await createStory(values.source, values.singularity);
    setChatId(id);
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
                      default:
                        return null;
                    }
                  })}
                </MessageContent>
              </Message>
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        {question ? (
          <StoryQuestion
            question={question}
            onSubmit={async (message) => await sendMessage(message)}
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
