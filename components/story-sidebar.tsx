"use client";

import { PanelLeftClose, Plus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { useSession } from "@/lib/auth/client";
import { Chat } from "@/lib/db/schema";
import { formatRelativeTime } from "@/lib/utils";
import { groupChatsByTime } from "@/lib/utils/group-chats";

import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "./ui/sidebar";
import { Skeleton } from "./ui/skeleton";
import { Spinner } from "./ui/spinner";

function getInitials(name: string | null | undefined) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const SkeletonMenu = () => (
  <>
    {[
      { label: "今天", count: 2 },
      { label: "本周", count: 4 },
    ].map((group, index) => (
      <SidebarGroup key={group.label} className={index > 0 ? "pt-1" : ""}>
        <SidebarGroupLabel className="text-muted-foreground/60 text-xs font-medium tracking-wider uppercase">
          {group.label}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {Array.from({ length: group.count }).map((_, i) => (
              <SidebarMenuItem className="mb-1" key={i}>
                <Skeleton className="h-6 w-full" />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    ))}
  </>
);

function SidebarLogo() {
  const { state, toggleSidebar } = useSidebar();

  if (state === "collapsed") {
    return (
      <button
        type="button"
        aria-label="展开故事列表"
        title="展开故事列表"
        className="bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/80 focus-visible:ring-sidebar-ring flex size-8 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2"
        onClick={toggleSidebar}
      >
        <span className="font-heading text-sm font-bold">P</span>
      </button>
    );
  }

  return (
    <div className="flex h-8 min-w-0 cursor-default items-center rounded-lg px-2">
      <span className="font-heading text-foreground text-xl font-bold tracking-widest">
        PLANB
      </span>
    </div>
  );
}

function StorySidebarToggle() {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      aria-label="收起故事列表"
      title="收起故事列表"
      className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring flex size-8 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2 group-data-[collapsible=icon]:hidden"
      onClick={toggleSidebar}
    >
      <PanelLeftClose className="size-4" />
    </button>
  );
}

export default function StorySidebar({
  chats,
  hasMore,
  isLoading,
  isLoadingMore,
  onLoadMore,
  error,
}: {
  chats: Chat[];
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  error?: string | null;
}) {
  const { data: session } = useSession();
  const params = useParams<{ chat?: string[] }>();
  const activeChatId = params?.chat?.[0];
  const groups = groupChatsByTime(chats);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || isLoadingMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-sidebar-border/70 border-b py-3 group-data-[collapsible=icon]:items-center">
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col">
          <SidebarLogo />
          <StorySidebarToggle />
        </div>
      </SidebarHeader>
      <SidebarContent className="pt-2 group-data-[collapsible=icon]:items-center">
        <SidebarMenuItem className="mb-2 px-2 group-data-[collapsible=icon]:px-0">
          <SidebarMenuButton asChild tooltip="开始新的故事">
            <Link href="/story">
              <Plus className="size-4" />
              <span>
                {chats.length === 0 ? "开始你的第一个故事" : "开始新的故事"}
              </span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <div className="group-data-[collapsible=icon]:hidden">
          {isLoading ? (
            <SkeletonMenu />
          ) : (
            groups.map((group, index) => (
              <SidebarGroup
                key={group.label}
                className={index > 0 ? "pt-1" : ""}
              >
                <SidebarGroupLabel className="text-muted-foreground/60 text-xs font-medium tracking-wider uppercase">
                  {group.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.chats.map((chat) => (
                      <SidebarMenuItem key={chat.id} className="group">
                        <SidebarMenuButton
                          isActive={chat.id === activeChatId}
                          asChild
                        >
                          <Link
                            href={`/story/${chat.id}`}
                            className="flex items-center justify-between"
                          >
                            <span className="truncate text-sm">
                              {chat.title || "未命名故事"}
                            </span>
                            <span className="text-muted-foreground ml-auto text-xs opacity-0 transition-opacity group-hover:opacity-100">
                              {formatRelativeTime(chat.updatedAt)}
                            </span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))
          )}
          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center p-4">
              {isLoadingMore ? <Spinner className="size-4" /> : null}
            </div>
          )}
          {error && hasMore && (
            <div className="p-4 text-center">
              <p className="text-destructive mb-2 text-sm">加载失败</p>
              <Button
                variant="outline"
                size="sm"
                onClick={onLoadMore}
                className="w-full"
              >
                重试
              </Button>
            </div>
          )}
          {groups.length === 0 && !isLoading && (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">
              还没有故事
            </p>
          )}
        </div>
      </SidebarContent>
      <SidebarFooter className="border-sidebar-border/70 border-t group-data-[collapsible=icon]:items-center">
        {session?.user && (
          <div className="flex min-w-0 items-center gap-3 px-2 py-2 group-data-[collapsible=icon]:px-0">
            <Avatar className="size-8">
              <AvatarImage
                src={session.user.image || ""}
                alt={session.user.name}
              />
              <AvatarFallback>{getInitials(session.user.name)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-sm font-medium group-data-[collapsible=icon]:hidden">
              {session.user.name}
            </span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
