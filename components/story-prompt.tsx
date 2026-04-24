"use client";

import type { ComponentProps } from "react";
import { useCallback } from "react";

import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import {
  PromptInput,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";
import { cn } from "@/lib/utils";

/**
 * Shared interface for Story input components (Prompt and Question).
 * T parameterizes the user's raw input type:
 * - StoryPrompt: T = string (raw text)
 * - StoryQuestion: T = structured object (e.g. Record<string, string>)
 */
export interface StoryInputProps<T> {
  /** Current input value */
  input: T;
  /** Update input value */
  onInputChange: (value: T) => void;
  /** Submit — both Prompt and Question use the same sendMessage signature */
  onSubmit: (message: PromptInputMessage) => void | Promise<void>;
  /** Whether the input is disabled (e.g. during streaming) */
  disabled?: boolean;
  /** Additional CSS class */
  className?: string;
}

export type { PromptInputMessage };
type StoryPromptInputProps = Omit<
  ComponentProps<typeof PromptInputTextarea>,
  "value" | "onChange"
> & {
  value?: string;
  onChange?: (value: string) => void;
};

export const StoryPromptInput = ({
  value,
  onChange,
  className,
  ...props
}: StoryPromptInputProps) => {
  const controller = usePromptInputController();

  const effectiveValue = value ?? controller.textInput.value;
  const effectiveOnChange = onChange ?? controller.textInput.setInput;

  return (
    <PromptInputTextarea
      value={effectiveValue}
      onChange={(e) => effectiveOnChange(e.currentTarget.value)}
      className={cn("pr-12", className)}
      {...props}
    />
  );
};

type StoryPromptSubmitProps = Omit<
  ComponentProps<typeof PromptInputSubmit>,
  "disabled"
> & {
  input?: string;
  disabled?: boolean;
};

export const StoryPromptSubmit = ({
  input,
  disabled = false,
  className,
  ...props
}: StoryPromptSubmitProps) => {
  const controller = usePromptInputController();
  const effectiveInput = input ?? controller.textInput.value;
  const isDisabled = !effectiveInput.trim() || disabled;

  return (
    <PromptInputSubmit
      disabled={isDisabled}
      className={cn("absolute right-1 bottom-1", className)}
      {...props}
    />
  );
};

type StoryPromptProps = StoryInputProps<string> & {
  children: React.ReactNode;
};

export const StoryPrompt = ({
  input,
  onInputChange,
  onSubmit,
  disabled = false,
  className,
  children,
}: StoryPromptProps) => {
  const handleSubmit = useCallback(
    async (message: Parameters<typeof onSubmit>[0]) => {
      if (disabled) return;
      await onSubmit(message);
      onInputChange("");
    },
    [disabled, onSubmit, onInputChange],
  );

  return (
    <PromptInputProvider initialInput={input}>
      <PromptInput onSubmit={handleSubmit} className={className}>
        {children}
      </PromptInput>
    </PromptInputProvider>
  );
};
