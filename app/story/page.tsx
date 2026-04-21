"use client";

import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/auth/client";

export default function CreateStoryPage() {
  const { data: session, isPending } = useSession();
  const [storyOrigin, setStoryOrigin] = useState("");
  const [singularityPoint, setSingularityPoint] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const completion = Math.min(
    100,
    Math.round(
      (storyOrigin.trim() ? 50 : 0) + (singularityPoint.trim() ? 50 : 0),
    ),
  );

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();

    if (!storyOrigin.trim() || !singularityPoint.trim()) {
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      router.push("/story/chat");
      setIsSubmitting(false);
    }, 600);
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
            每一个 &quot;如果&quot; 都是一个全新世界的起点。
            描述你想要探索的故事，以及那个改变一切的转折点。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="group">
            <label
              htmlFor="storyOrigin"
              className="text-foreground mb-3 flex items-center gap-2 text-sm font-medium"
            >
              <BookOpen className="text-accent size-4" />
              <span>故事来源</span>
            </label>

            <Input
              id="storyOrigin"
              type="text"
              value={storyOrigin}
              onChange={(e) => setStoryOrigin(e.target.value)}
              placeholder="三国演义、罗马帝国历史、权力的游戏..."
              className="bg-card border-border/60 focus:border-accent/50 placeholder:text-muted-foreground/60 h-12 text-base transition-all duration-300"
            />

            <p className="text-muted-foreground mt-2.5 text-sm">
              可以是任何真实或虚构的故事 — 历史、小说、影视，甚至传说
            </p>
          </div>

          <div className="group">
            <label
              htmlFor="singularityPoint"
              className="text-foreground mb-3 flex items-center gap-2 text-sm font-medium"
            >
              <Sparkles className="text-accent size-4" />
              <span>特异点</span>
            </label>

            <Textarea
              id="singularityPoint"
              value={singularityPoint}
              onChange={(e) => setSingularityPoint(e.target.value)}
              placeholder="如果诸葛亮没有病死五丈原... 如果凯撒没有渡过卢比孔河... 如果某个关键事件走向了另一个方向..."
              className="bg-card border-border/60 focus:border-accent/50 placeholder:text-muted-foreground/60 min-h-32 resize-none text-base leading-relaxed transition-all duration-300"
            />

            <p className="text-muted-foreground mt-2.5 text-sm">
              这是时间轴被强行撕裂的地方 — 描述那个改变一切的瞬间
            </p>
          </div>

          <div className="flex items-center gap-4 py-4">
            <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
              <div
                className="from-accent/80 to-accent ease-out-quint h-full rounded-full bg-linear-to-r transition-all duration-500"
                style={{ width: `${completion}%` }}
              />
            </div>
            <span className="text-muted-foreground min-w-10 text-right text-sm font-medium">
              {completion}%
            </span>
          </div>

          <div className="pt-4">
            <Button
              type="submit"
              size="lg"
              disabled={
                !storyOrigin.trim() || !singularityPoint.trim() || isSubmitting
              }
              className="bg-accent text-accent-foreground hover:bg-accent/90 h-12 w-full gap-2 text-base font-medium transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>正在打开世界...</span>
                </>
              ) : (
                <>
                  <span>开启故事</span>
                  <ArrowRight className="size-5 transition-transform duration-300 group-hover:translate-x-0.5" />
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
