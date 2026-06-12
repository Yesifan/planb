"use client";

import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Braces,
  ClipboardList,
  PanelRightClose,
  PanelRightOpen,
  UserRound,
} from "lucide-react";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";

import {
  getChatTokens,
  getProtagonistState,
  getStoryRuntimeState,
} from "@/lib/actions/db";
import { cn } from "@/lib/utils";

import { StatDimension } from "./stat-dimension";
import { Button } from "./ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  useSidebar,
} from "./ui/sidebar";
import { Skeleton } from "./ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

const streamdownPlugins = { cjk, code, math, mermaid };

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

function EmptyPanel({ label }: { label: string }) {
  return <div className="text-muted-foreground px-2 py-4 text-sm">{label}</div>;
}

function MarkdownPanel({
  className,
  content,
}: {
  className?: string;
  content?: string | null;
}) {
  if (!content) {
    return <EmptyPanel label="暂无状态" />;
  }
  return (
    <Streamdown
      plugins={streamdownPlugins}
      className={cn(
        "text-foreground/90 px-3 py-3 text-sm leading-6",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        "[&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-medium",
        "[&_li]:my-1 [&_ol]:my-2 [&_ol]:pl-5 [&_p]:my-2 [&_ul]:my-2 [&_ul]:pl-5",
        "[&_code]:bg-muted [&_code]:rounded-md [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs",
        "[&_hr]:border-sidebar-border [&_hr]:my-4",
        "[&_strong]:font-semibold",
        className,
      )}
    >
      {content}
    </Streamdown>
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
  const [protagonist, setProtagonist] = useState<Awaited<
    ReturnType<typeof getProtagonistState>
  > | null>(null);
  const [runtimeState, setRuntimeState] = useState<Awaited<
    ReturnType<typeof getStoryRuntimeState>
  > | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevIsStreamingRef = useRef(isStreaming);

  const fetchTokens = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tokenData, protagonistData, runtimeData] = await Promise.all([
        getChatTokens(chatId),
        getProtagonistState(chatId),
        getStoryRuntimeState(chatId),
      ]);
      setTokens(tokenData);
      setProtagonist(protagonistData ?? null);
      setRuntimeState(runtimeData ?? null);
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
            <p className="text-muted-foreground text-xs">状态 / 任务 / Token</p>
          </div>
          <ChatRightSidebarTrigger className="size-7 rounded-lg" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        {error ? (
          <div className="text-destructive py-4 text-center text-sm">
            {error}
          </div>
        ) : isLoading ? (
          <LoadingSkeleton />
        ) : (
          <Tabs defaultValue="state" className="h-full gap-0">
            <div className="border-sidebar-border/70 border-b px-2 py-2">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="state">
                  <UserRound />
                  状态
                </TabsTrigger>
                <TabsTrigger value="tasks">
                  <ClipboardList />
                  任务
                </TabsTrigger>
                <TabsTrigger value="tokens">
                  <Braces />
                  Token
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="state" className="min-h-0 overflow-auto">
              {protagonist ? (
                <div className="flex flex-col gap-3 p-4">
                  <div>
                    <div className="text-sm font-medium">主角</div>
                    <p className="text-muted-foreground mt-1 text-sm leading-6">
                      {protagonist.profile}
                    </p>
                  </div>
                  <StatDimension dimensions={protagonist.dimensions} />
                </div>
              ) : (
                <EmptyPanel label="暂无主角状态" />
              )}
            </TabsContent>
            <TabsContent value="tasks" className="min-h-0 overflow-auto">
              <MarkdownPanel
                className={cn(
                  "text-xs leading-5",
                  "[&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs",
                )}
                content={runtimeState?.taskState}
              />
            </TabsContent>
            <TabsContent value="tokens" className="min-h-0 overflow-auto">
              {tokens ? (
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
              ) : (
                <EmptyPanel label="暂无 Token 数据" />
              )}
            </TabsContent>
          </Tabs>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
