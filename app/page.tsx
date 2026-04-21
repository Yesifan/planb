import { Wand2, Zap } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth/server";

export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  console.debug("session", session);
  const isLoggedIn = !!session;

  return (
    <div className="flex min-h-screen w-screen items-center justify-center">
      <Link href={isLoggedIn ? "/story" : "/login"}>
        <Button size="lg">
          {isLoggedIn ? (
            <>
              <Wand2 className="h-5 w-5 transition-transform duration-500" />
              开始创作
            </>
          ) : (
            <>
              <Zap className="h-5 w-5 transition-transform duration-500" />
              开始登录
            </>
          )}
        </Button>
      </Link>
    </div>
  );
}
