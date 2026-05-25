"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { HelpCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import type { CreateQuestion } from "@/lib/llm/tool";
import logger from "@/lib/logger";
import { cn } from "@/lib/utils";

import type { StoryInputProps } from "./story-prompt";
import { Button } from "./ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "./ui/field";
import { Textarea } from "./ui/textarea";

interface StoryQuestionProps extends StoryInputProps<Record<string, string>> {
  question: Partial<CreateQuestion>;
  /** 已答待重试态: 传入则进入只读+重试模式 */
  answer?: string;
  /** 已答待重试态下的重试回调 */
  onRetry?: () => Promise<void>;
}

/**
 * 解析 `formatQuestionAnswer` 生成的格式化字符串,还原为 question -> answer 映射。
 * 按第一个 `: ` 切分以保留答案中可能存在的冒号。
 */
export function parseAnswer(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const match = line.match(/^- (.+?): (.+)$/);
    if (!match) continue;
    const [, key, value] = match;
    result[key] = value;
  }
  return result;
}

/**
 * 将 question -> answer 映射格式化为可投喂给 LLM 的多行字符串。
 * 格式: `- 问题: 答案`,每行一条。
 */
export function formatQuestionAnswer(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");
}

export default function StoryQuestion({
  question,
  onSubmit,
  disabled = false,
  className,
  answer: answeredOutput,
  onRetry,
}: Omit<StoryQuestionProps, "input" | "onInputChange">) {
  const [isPending, setIsPending] = useState(false);
  const isRetry = Boolean(answeredOutput);
  const answers = answeredOutput ? parseAnswer(answeredOutput) : null;

  const schemaFields = question.questions?.reduce(
    (acc, item) => {
      acc[item.question] = z.string().min(1, item.describe);
      return acc;
    },
    {} as Record<string, z.ZodString>,
  );

  const schema = z.object(schemaFields);

  const form = useForm({
    resolver: zodResolver(schema),
  });

  const handleSubmit = async (values: z.infer<typeof schema>) => {
    if (disabled) return;
    const prompt = formatQuestionAnswer(values);
    logger.info({ values, prompt }, "story question submit");
    await onSubmit({ text: prompt, files: [] });
  };

  const handleRetry = async () => {
    if (!onRetry) return;
    setIsPending(true);
    try {
      await onRetry();
    } finally {
      setIsPending(false);
    }
  };

  const subtitle = isRetry
    ? "上次生成中断,可基于以下回答重试"
    : question.describe;

  const header = (
    <div className="mb-6 flex items-start gap-3">
      <div
        className={cn(
          "rounded-full p-2",
          isRetry
            ? "bg-muted text-muted-foreground"
            : "bg-accent/10 text-accent",
        )}
      >
        <HelpCircle className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-foreground font-medium">{question.title}</h3>
        {subtitle && (
          <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
        )}
      </div>
    </div>
  );

  const fields = (
    <FieldGroup>
      {question?.questions?.map((q) => {
        if (isRetry) {
          return (
            <Field key={q.question}>
              <FieldLabel htmlFor={q.question}>{q.question}</FieldLabel>
              <Textarea
                id={q.question}
                rows={1}
                disabled
                defaultValue={answers?.[q.question]}
              />
              {q.describe && <FieldDescription>{q.describe}</FieldDescription>}
            </Field>
          );
        }
        return (
          <Controller
            key={q.question}
            control={form.control}
            name={q.question}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={q.question}>{q.question}</FieldLabel>
                <Textarea
                  id={q.question}
                  rows={1}
                  {...field}
                  aria-invalid={fieldState.invalid}
                  placeholder="请输入您的回答..."
                />
                {q.describe && (
                  <FieldDescription>{q.describe}</FieldDescription>
                )}
                <FieldError errors={[fieldState.error?.message]} />
              </Field>
            )}
          />
        );
      })}
    </FieldGroup>
  );

  const submit = isRetry ? (
    <Button
      type="button"
      disabled={disabled || isPending || !onRetry}
      onClick={handleRetry}
      className="w-full"
    >
      <RefreshCw
        className={isPending ? "animate-spin" : undefined}
        data-icon="inline-start"
      />
      重试生成
    </Button>
  ) : (
    <Button
      type="submit"
      disabled={disabled}
      className="bg-accent text-accent-foreground hover:bg-accent/90 w-full"
    >
      提交回答
    </Button>
  );

  const containerClass = cn(
    "bg-muted/20 border-border/50 mx-auto w-full max-w-2xl rounded-xl border p-6",
    className,
  );

  if (isRetry) {
    return (
      <div className={containerClass}>
        {header}
        {fields}
        <div className="mt-6">{submit}</div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      {header}
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        {fields}
        <div className="mt-6">{submit}</div>
      </form>
    </div>
  );
}
