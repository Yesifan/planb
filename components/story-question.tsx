"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { HelpCircle } from "lucide-react";
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
}

export default function StoryQuestion({
  question,
  onSubmit,
  disabled = false,
  className,
}: Omit<StoryQuestionProps, "input" | "onInputChange">) {
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
    const prompt = Object.keys(values).reduce((acc, key) => {
      acc += `<${key}>${values[key]}</${key}>`;
      return acc;
    }, "");
    logger.info({ values, prompt }, "story question submit");
    await onSubmit({ text: prompt, files: [] });
  };

  return (
    <div
      className={cn(
        "bg-muted/20 border-border/50 mx-auto w-full max-w-2xl rounded-xl border p-6",
        className,
      )}
    >
      <div className="mb-6 flex items-start gap-3">
        <div className="bg-accent/10 text-accent rounded-full p-2">
          <HelpCircle className="size-5" />
        </div>
        <div>
          <h3 className="">{question.title}</h3>
          {question.describe && (
            <p className="text-muted-foreground mt-1">{question.describe}</p>
          )}
        </div>
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <FieldGroup>
          {question?.questions?.map((q) => {
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

        <div className="mt-6">
          <Button
            type="submit"
            disabled={disabled}
            className="bg-accent text-accent-foreground hover:bg-accent/90 w-full"
          >
            提交回答
          </Button>
        </div>
      </form>
    </div>
  );
}
