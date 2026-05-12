"use client";

import { ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export default function StoryRejection({
  reason,
  className,
}: {
  reason: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-amber-500/50 bg-amber-50 p-4 dark:bg-amber-950/20",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 text-amber-600 dark:text-amber-400">
          <ShieldAlert className="size-5" />
        </div>
        <div>
          <h3 className="font-medium text-amber-900 dark:text-amber-100">
            输入被拒绝
          </h3>
          <p className="mt-1 text-amber-800 dark:text-amber-200">{reason}</p>
        </div>
      </div>
    </div>
  );
}
