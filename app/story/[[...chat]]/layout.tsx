"use client";

import { StoryProvider } from "@/hooks/use-story";

export default function StoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StoryProvider>{children}</StoryProvider>;
}
