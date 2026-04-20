"use client";

import { useEffect, useState } from "react";
import { FaGithub } from "react-icons/fa";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import authClient from "@/lib/auth/client";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const data = await authClient.signIn.social({ provider: "github" });
      console.debug("data", data);
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm">
        <div
          className={cn(
            "mb-8 text-center transition-opacity duration-500 ease-out",
          )}
          style={{ animationDelay: "0ms" }}
        >
          <h1 className="font-(--font-quicksand) text-5xl tracking-tight text-foreground sm:text-6xl">
            PLANB
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            AI 驱动的互动叙事系统
          </p>
        </div>

        <Card
          className={cn("w-full transition-transform duration-500 ease-out")}
          style={{ animationDelay: "100ms" }}
        >
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold">登录</CardTitle>
            <CardDescription>
              使用 GitHub 账号登录继续访问你的故事
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            <Button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full gap-2 h-12 text-base font-medium transition-all duration-150 ease-out hover:scale-[1.02] active:scale-[0.98] bg-accent text-accent-foreground hover:bg-accent/90 cursor-pointer"
            >
              <FaGithub className="size-5" />
              {isLoading ? "登录中..." : "使用 GitHub 登录"}
            </Button>
          </CardContent>
          <CardFooter className="flex justify-center border-t pt-4 text-xs text-muted-foreground">
            目前仅支持 GitHub 账号登录
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
