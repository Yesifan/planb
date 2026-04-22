import { Wand2 } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth/server";

function PortalEffect() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      {/* 核心发光 - 最亮区域 */}
      <div className="bg-accent/50 animate-pulse-glow absolute h-40 w-40 rounded-full blur-2xl md:h-60 md:w-60" />

      {/* 内核 - 高亮点 */}
      <div className="bg-accent animate-sparkle absolute h-8 w-8 rounded-full blur-sm md:h-12 md:w-12" />
    </div>
  );
}

export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const isLoggedIn = !!session;

  return (
    <main className="dark bg-background relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden">
      <PortalEffect />

      <div className="relative z-10 flex max-w-2xl flex-col items-center px-6 text-center">
        <h1 className="animate-fade-in-up text-foreground mb-6 text-4xl font-semibold tracking-tight md:text-5xl">
          你的故事，正在等待被书写
        </h1>

        <div className="animate-fade-in-up via-accent/60 mb-6 h-px w-24 bg-linear-to-r from-transparent to-transparent delay-100" />

        <p className="animate-fade-in-up text-muted-foreground mb-10 text-lg leading-relaxed delay-200 md:text-xl">
          这是属于你的异世界。
          <br />
          在这里，你可以成为任何人，改变任何事。
        </p>

        <div className="animate-fade-in-up delay-350">
          <Link href={isLoggedIn ? "/story" : "/login"}>
            <Button
              size="lg"
              className="group bg-accent/20 border-accent/30 h-12 rounded-full border px-8 text-base text-white backdrop-blur-md active:scale-95"
            >
              <Wand2 />
              开始创作
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
