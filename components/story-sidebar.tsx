"use client";

import { Plus } from "lucide-react";
import { motion } from "motion/react";
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

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
      <SidebarHeader className="py-3">
        <motion.div
          className="flex cursor-default items-center px-2"
          whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          {"PLANB".split("").map((char, i) => (
            <motion.span
              key={i}
              initial={
                prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 4 }
              }
              animate={{ opacity: 1, y: 0 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : {
                      delay: 0.1 + i * 0.06,
                      duration: 0.4,
                      ease: [0.22, 1, 0.36, 1],
                    }
              }
              className="font-heading text-foreground inline-block text-xl font-bold tracking-widest"
            >
              {char}
            </motion.span>
          ))}
        </motion.div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenuItem className="mb-2 px-2">
          <Link
            href="/story"
            className="bg-accent text-accent-foreground hover:bg-accent/80 flex w-full items-center gap-2 rounded-lg p-2 text-sm font-medium transition-colors"
          >
            <Plus className="size-4" />
            {chats.length === 0 ? "开始你的第一个故事" : "开始新的故事"}
          </Link>
        </SidebarMenuItem>
        {isLoading ? (
          <SkeletonMenu />
        ) : (
          groups.map((group, index) => (
            <SidebarGroup key={group.label} className={index > 0 ? "pt-1" : ""}>
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
      </SidebarContent>
      {session?.user && (
        <SidebarFooter>
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar className="size-8">
              <AvatarImage
                src={session.user.image || ""}
                alt={session.user.name}
              />
              <AvatarFallback>{getInitials(session.user.name)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-sm font-medium">
              {session.user.name}
            </span>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
