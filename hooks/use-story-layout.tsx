"use client";

import { createContext, useContext } from "react";

const StoryLayoutContext = createContext<{
  refreshChatList: () => void;
} | null>(null);

export function StoryLayoutProvider({
  value,
  children,
}: {
  value: { refreshChatList: () => void };
  children: React.ReactNode;
}) {
  return (
    <StoryLayoutContext.Provider value={value}>
      {children}
    </StoryLayoutContext.Provider>
  );
}

export function useStoryLayout() {
  const ctx = useContext(StoryLayoutContext);
  if (!ctx)
    throw new Error("useStoryLayout must be used within StoryLayoutProvider");
  return ctx;
}
