"use client";

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
            error={chatList.error}
          />
          {children}
        </SidebarProvider>
      </StoryLayoutProvider>
    </StoryProvider>
  );
}
