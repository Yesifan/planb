"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createStory } from "@/lib/actions/llm";

const formSchema = z.object({
  source: z.string().min(1, "故事来源不能为空"),
  singularity: z.string().min(1, "特异点不能为空"),
});

export default function CreateStoryPage() {
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      source: "",
      singularity: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const [chatId, questions] = await createStory(
        values.source,
        values.singularity,
      );
      router.push(`/story/${chatId}`);
    } catch (error) {
      console.error("Failed to create story:", error);
      toast.error("创建故事失败，请重试");
    }
  };

  return (
    <div className="from-background via-background to-muted/30 min-h-screen bg-linear-to-b">
      <div className="mx-auto max-w-2xl px-6 py-16 md:py-24">
        <div className="mb-12">
          <div className="bg-accent/10 text-accent mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm">
            <Sparkles className="size-4" />
            <span>创作你的异世界</span>
          </div>

          <h1
            className="text-foreground mb-4 text-4xl font-semibold tracking-tight"
            style={{
              fontFamily: "var(--font-heading)",
            }}
          >
            故事从这里开始
          </h1>

          <p className="text-muted-foreground max-w-lg text-lg leading-relaxed">
            每一个
            <span className="bg-linear-to-r from-blue-500 to-purple-600 bg-clip-text px-2 text-xl font-bold text-transparent">
              如果
            </span>
            都是一个全新世界的起点。
            描述你想要探索的故事，以及那个改变一切的转折点。
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              control={form.control}
              name="source"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="source" className="mb-3">
                    <BookOpen className="text-accent size-4" />
                    <span>故事来源</span>
                  </FieldLabel>
                  <Input
                    id="source"
                    {...field}
                    aria-invalid={fieldState.invalid}
                    placeholder="三国演义、罗马帝国历史、权力的游戏..."
                    className="bg-card border-border/60 focus:border-accent/50 placeholder:text-muted-foreground/60 h-12 text-base transition-all duration-300"
                  />
                  <FieldDescription className="mt-2.5">
                    可以是任何真实或虚构的故事 — 历史、小说、影视，甚至传说
                  </FieldDescription>
                  <FieldError errors={[fieldState.error?.message]} />
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="singularity"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="singularity" className="mb-3">
                    <Sparkles className="text-accent size-4" />
                    <span>特异点</span>
                  </FieldLabel>
                  <Textarea
                    id="singularity"
                    {...field}
                    aria-invalid={fieldState.invalid}
                    placeholder="如果诸葛亮没有病死五丈原... 如果凯撒没有渡过卢比孔河... 如果某个关键事件走向了另一个方向..."
                    className="bg-card border-border/60 focus:border-accent/50 placeholder:text-muted-foreground/60 min-h-32 resize-none text-base leading-relaxed transition-all duration-300"
                  />
                  <FieldDescription className="mt-2.5">
                    这是时间轴被强行撕裂的地方 — 描述那个改变一切的瞬间
                  </FieldDescription>
                  <FieldError errors={[fieldState.error?.message]} />
                </Field>
              )}
            />
          </FieldGroup>

          <div className="pt-4">
            <Button
              type="submit"
              size="lg"
              disabled={form.formState.isSubmitting}
              className="bg-accent text-accent-foreground hover:bg-accent/90 h-12 w-full gap-2 text-base font-medium transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {form.formState.isSubmitting ? (
                <>
                  <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>正在打开世界...</span>
                </>
              ) : (
                <>
                  <span>开启故事</span>
                  <ArrowRight />
                </>
              )}
            </Button>

            <p className="text-muted-foreground/70 mt-4 text-center text-sm">
              AI 将基于你的描述生成独特的互动叙事
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
