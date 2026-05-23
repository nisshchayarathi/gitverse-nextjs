"use client";

import { useState, useCallback, useRef } from "react";
import { buildApiUrl } from "@/services/apiConfig";

export interface UserSummary {
  id: number;
  name: string;
  email: string;
  image: string | null;
  createdAt: string;
}

export interface UseUsersOptions {
  /** Number of users to fetch per page (default: 20, max: 100). */
  limit?: number;
}

export interface UseUsersResult {
  users: UserSummary[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  reset: () => void;
}

/**
 * Hook that fetches users with cursor-based pagination.
 *
 * Usage:
 *   const { users, isLoading, hasMore, loadMore } = useUsers({ limit: 20 });
 */
export function useUsers({ limit = 20 }: UseUsersOptions = {}): UseUsersResult {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Track whether the initial fetch has been triggered.
  const initialised = useRef(false);

  const fetchPage = useCallback(
    async (cursor: string | null, isFirstPage: boolean) => {
      if (isFirstPage) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams({ limit: String(limit) });
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(buildApiUrl(`/api/users?${params.toString()}`), {
          credentials: "include",
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `Request failed with status ${res.status}`);
        }

        const json: { data: UserSummary[]; nextCursor: string | null } =
          await res.json();

        setUsers((prev) =>
          isFirstPage ? json.data : [...prev, ...json.data]
        );
        setNextCursor(json.nextCursor);
        setHasMore(json.nextCursor !== null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load users");
      } finally {
        if (isFirstPage) {
          setIsLoading(false);
        } else {
          setIsLoadingMore(false);
        }
      }
    },
    [limit]
  );

  // Kick off the first page on first render (lazy init pattern avoids
  // double-fetch in React Strict Mode).
  if (!initialised.current) {
    initialised.current = true;
    // Schedule outside the render cycle.
    setTimeout(() => fetchPage(null, true), 0);
  }

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading || isLoadingMore) return;
    fetchPage(nextCursor, false);
  }, [hasMore, isLoading, isLoadingMore, nextCursor, fetchPage]);

  const reset = useCallback(() => {
    setUsers([]);
    setNextCursor(null);
    setHasMore(true);
    setError(null);
    initialised.current = false;
    fetchPage(null, true);
  }, [fetchPage]);

  return { users, isLoading, isLoadingMore, error, hasMore, loadMore, reset };
}
