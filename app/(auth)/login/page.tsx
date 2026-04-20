"use client";

import { useState } from "react";
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">登录</CardTitle>
          <CardDescription>使用 GitHub 账号登录继续访问</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full gap-2"
          >
            <FaGithub data-icon="inline-start" />
            {isLoading ? "登录中..." : "使用 GitHub 登录"}
          </Button>
        </CardContent>
        <CardFooter className="flex justify-center text-sm text-muted-foreground">
          仅支持 GitHub 账号登录
        </CardFooter>
      </Card>
    </div>
  );
}
