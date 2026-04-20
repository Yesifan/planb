"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { signOut,useSession } from "@/lib/auth/client";

export default function HomePage() {
  const { data: session } = useSession();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8">欢迎来到 Planb</h1>
        
        {session ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-lg">
              欢迎回来，<span className="font-semibold">{session.user.name || session.user.email}</span>
            </p>
            {session.user.image && (
              <img 
                src={session.user.image} 
                alt="头像" 
                className="w-16 h-16 rounded-full"
              />
            )}
            <Button onClick={() => signOut()} variant="outline">
              登出
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <p className="text-lg text-muted-foreground">
              欢迎使用，请登录以继续
            </p>
            <Link href="/login">
              <Button>前往登录</Button>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
