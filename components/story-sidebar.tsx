"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { Chat } from "@/lib/db/schema";
import { formatRelativeTime } from "@/lib/utils";
import { groupChatsByTime } from "@/lib/utils/group-chats";

import { Button } from "./ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar";
import { Skeleton } from "./ui/skeleton";
import { Spinner } from "./ui/spinner";

export default function StorySidebar({
  chats,
  hasMore,
  isLoading,
  isLoadingMore,
  onLoadMore,
  onNewStory,
  error,
}: {
  chats: Chat[];
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onNewStory: () => void;
  error?: string | null;
}) {
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
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <div className="flex items-center justify-between">
          <span className="font-heading text-sm font-medium">故事</span>
          <SidebarMenuButton asChild>
            <Button variant="ghost" size="icon-sm" onClick={onNewStory}>
              <Plus className="size-4" />
              <span className="sr-only">新建故事</span>
            </Button>
          </SidebarMenuButton>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {isLoading ? (
          <SidebarMenu>
            {[1, 2, 3, 4].map((i) => (
              <SidebarMenuItem key={i}>
                <SidebarMenuButton asChild>
                  <div className="w-full">
                    <Skeleton className="h-8 w-full" />
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        ) : chats.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            开始你的第一个故事
          </div>
        ) : (
          groups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.chats.map((chat) => (
                    <SidebarMenuItem key={chat.id} className="group">
                      <SidebarMenuButton
                        isActive={chat.id === activeChatId}
                        asChild
                      >
                        <Link href={`/story/${chat.id}`}>
                          <span className="truncate">{chat.title || "未命名故事"}</span>
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
            <p className="text-sm text-destructive mb-2">加载失败</p>
            <Button variant="ghost" size="sm" onClick={onLoadMore}>
              重试
            </Button>
          </div>
        )}
        {hasMore && !isLoadingMore && !error && (
          <div className="p-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onLoadMore}
              className="w-full"
            >
              加载更多
            </Button>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
