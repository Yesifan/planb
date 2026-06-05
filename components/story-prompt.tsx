"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";
import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useState,
} from "react";

import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
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
  return (
    <PromptInputTextarea
      value={value}
      onChange={(e) => onChange?.(e.currentTarget.value)}
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
  const isDisabled = !input?.trim() || disabled;

  return (
    <PromptInputSubmit
      disabled={isDisabled}
      className={cn("absolute right-1 bottom-1", className)}
      {...props}
    />
  );
};

type StoryPromptProps = StoryInputProps<string> & {
  children: ReactNode;
};

export const StoryPrompt = ({
  input,
  onInputChange,
  onSubmit,
  disabled = false,
  className,
  children,
}: StoryPromptProps) => {
  const [text, setText] = useState(input);

  useEffect(() => {
    setText(input);
  }, [input]);

  const handleSubmit = useCallback(
    async (message: Parameters<typeof onSubmit>[0]) => {
      if (disabled) return;
      setText("");
      onInputChange("");
      await onSubmit(message);
    },
    [disabled, onSubmit, onInputChange],
  );

  const controlledChildren = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;

    if (child.type === StoryPromptInput) {
      return cloneElement(child as ReactElement<StoryPromptInputProps>, {
        onChange: setText,
        value: text,
      });
    }

    if (child.type === StoryPromptSubmit) {
      return cloneElement(child as ReactElement<StoryPromptSubmitProps>, {
        disabled,
        input: text,
      });
    }

    return child;
  });

  return (
    <PromptInput onSubmit={handleSubmit} className={className}>
      {controlledChildren}
    </PromptInput>
  );
};
