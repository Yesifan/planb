"use client";

import { useRouter } from "next/navigation";

import StorySidebar from "@/components/story-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useChatList } from "@/hooks/use-chat-list";
import { StoryProvider } from "@/hooks/use-story";
import { StoryLayoutProvider } from "@/hooks/use-story-layout";

export default function StoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const chatList = useChatList();
  const router = useRouter();

  return (
    <StoryProvider>
      <StoryLayoutProvider value={{ refreshChatList: chatList.refresh }}>
        <SidebarProvider defaultOpen={true}>
          <StorySidebar
            chats={chatList.chats}
            hasMore={chatList.hasMore}
            isLoading={chatList.isLoading}
            isLoadingMore={chatList.isLoadingMore}
            onLoadMore={chatList.loadMore}
            onNewStory={() => router.push("/story")}
            error={chatList.error}
          />
          {children}
        </SidebarProvider>
      </StoryLayoutProvider>
    </StoryProvider>
  );
}
