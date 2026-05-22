"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getUserChats } from "@/lib/actions/db";
import type { Chat } from "@/lib/db/schema";

const PAGE_SIZE = 20;

type Cursor = { updatedAt: Date; id: string } | null;

export function useChatList() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<Cursor>(null);
  const [initialFetchDone, setInitialFetchDone] = useState(false);

  const isLoadingMoreRef = useRef(false);

  useEffect(() => {
    isLoadingMoreRef.current = isLoadingMore;
  }, [isLoadingMore]);

  useEffect(() => {
    let cancelled = false;
    getUserChats({ limit: PAGE_SIZE })
      .then((result) => {
        if (cancelled) return;
        setChats(result.chats);
        setNextCursor(result.nextCursor);
        setInitialFetchDone(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load chats");
        setInitialFetchDone(true);
      });
    return () => { cancelled = true; };
  }, []);

  const refresh = useCallback(() => {
    setError(null);
    return getUserChats({ limit: PAGE_SIZE })
      .then((result) => {
        setChats(result.chats);
        setNextCursor(result.nextCursor);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load chats");
      });
  }, []);

  const loadMore = useCallback(() => {
    if (!nextCursor || isLoadingMoreRef.current) return Promise.resolve();
    setIsLoadingMore(true);
    setError(null);
    return getUserChats({ cursor: nextCursor, limit: PAGE_SIZE })
      .then((result) => {
        setChats((prev) => [...prev, ...result.chats]);
        setNextCursor(result.nextCursor);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load more chats");
      })
      .finally(() => {
        setIsLoadingMore(false);
      });
  }, [nextCursor]);

  return {
    chats,
    isLoading: !initialFetchDone,
    isLoadingMore,
    error,
    hasMore: nextCursor !== null,
    loadMore,
    refresh,
  };
}
