"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Braces,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { getChatTokens } from "@/lib/actions/db";
import { cn } from "@/lib/utils";

import { Button } from "./ui/button";
import { Sidebar, SidebarContent, SidebarHeader, useSidebar } from "./ui/sidebar";
import { Skeleton } from "./ui/skeleton";

function TokenRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center justify-between px-2 py-2">
      <div className="flex items-center gap-2">
        <Icon className="text-muted-foreground size-4" />
        <span className="text-muted-foreground text-sm">{label}</span>
      </div>
      <span className="text-sm font-medium">{value.toLocaleString()}</span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-2 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

export function ChatRightSidebarTrigger({
  className,
  onClick,
  ...props
}: ComponentProps<typeof Button>) {
  const { isMobile, openMobile, state, toggleSidebar } = useSidebar();
  const isOpen = isMobile ? openMobile : state === "expanded";
  const Icon = isOpen ? PanelRightClose : PanelRightOpen;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(className)}
      aria-label={isOpen ? "关闭 Inspector" : "打开 Inspector"}
      title={isOpen ? "关闭 Inspector" : "打开 Inspector"}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <Icon />
      <span className="sr-only">
        {isOpen ? "关闭 Inspector" : "打开 Inspector"}
      </span>
    </Button>
  );
}

export function ChatRightSidebar({
  chatId,
  isStreaming,
}: {
  chatId: string;
  isStreaming: boolean;
}) {
  const [tokens, setTokens] = useState<{
    inputTokens: number;
    outputTokens: number;
    contextTokens: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevIsStreamingRef = useRef(isStreaming);

  const fetchTokens = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setTokens(await getChatTokens(chatId));
    } catch {
      setError("加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  useEffect(() => {
    if (prevIsStreamingRef.current && !isStreaming) {
      fetchTokens();
    }
    prevIsStreamingRef.current = isStreaming;
  }, [isStreaming, fetchTokens]);

  return (
    <Sidebar
      side="right"
      collapsible="offcanvas"
      className="absolute h-full md:border-l"
    >
      <SidebarHeader className="border-sidebar-border/70 border-b py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Inspector</h3>
            <p className="text-muted-foreground text-xs">Token 用量</p>
          </div>
          <ChatRightSidebarTrigger className="size-7 rounded-lg" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        {error ? (
          <div className="text-destructive px-2 py-4 text-center text-sm">
            {error}
          </div>
        ) : isLoading ? (
          <LoadingSkeleton />
        ) : tokens ? (
          <>
            <TokenRow
              label="Input Tokens"
              value={tokens.inputTokens}
              icon={ArrowDownToLine}
            />
            <TokenRow
              label="Output Tokens"
              value={tokens.outputTokens}
              icon={ArrowUpFromLine}
            />
            <TokenRow
              label="Context Tokens"
              value={tokens.contextTokens}
              icon={Braces}
            />
          </>
        ) : null}
      </SidebarContent>
    </Sidebar>
  );
}
