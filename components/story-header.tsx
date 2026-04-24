import { Chat } from "@/lib/db/schema";
import { formatRelativeTime } from "@/lib/utils";

export default function StoryHeader({ chat }: { chat?: Chat }) {
  return (
    <header className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-10 border-b backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <div className="flex flex-col">
          <h1 className="font-heading truncate text-lg font-semibold">
            {chat?.title || "未命名对话"}
          </h1>
          <div className="text-muted-foreground mt-1 flex gap-4 text-xs">
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
    </header>
  );
}
