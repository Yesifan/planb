import { Chat } from "@/lib/db/schema";
import { formatRelativeTime } from "@/lib/utils";

import { SidebarTrigger } from "./ui/sidebar";

export default function StoryHeader({ chat }: { chat?: Chat }) {
  return (
    <header className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-10 border-b backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
        <SidebarTrigger
          className="hover:bg-muted -ml-1 rounded-lg border md:hidden"
          aria-label="打开故事列表"
          title="打开故事列表"
        />
        <div className="flex flex-1 items-center justify-between">
          <div className="flex min-w-0 flex-col">
            <h1 className="font-heading truncate text-lg font-semibold">
              {chat?.title || "未命名对话"}
            </h1>
            <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {chat?.createdAt && (
                <span className="inline-flex items-center gap-1">
                  <span>创建: {formatRelativeTime(chat.createdAt)}</span>
                </span>
              )}
              {chat?.updatedAt && (
                <span className="inline-flex items-center gap-1">
                  <span>更新: {formatRelativeTime(chat.updatedAt)}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
