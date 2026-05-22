import { useState, useCallback, useEffect, useRef } from "react";
import type { PaginatedResponse } from "@/types/pagination";

export interface Repository {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  url: string;
  updatedAt: string;
}

interface UseRepositoriesReturn {
  repos: Repository[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => void;
  refresh: () => void;
}

const DEFAULT_LIMIT = 10;

export function useRepositories({ limit = DEFAULT_LIMIT } = {}): UseRepositoriesReturn {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setRepos([]);
    setCursor(null);
    setHasMore(true);

    fetch(`/api/repositories?limit=${limit}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed: ${r.status}`);
        return r.json() as Promise<PaginatedResponse<Repository>>;
      })
      .then((json) => {
        if (cancelled) return;
        setRepos(json.data);
        setCursor(json.nextCursor);
        setHasMore(json.hasMore);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [limit, refreshKey]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMoreRef.current || isLoading) return ;
    setIsLoadingMore(true);
    isLoadingMoreRef.current = true;
    setError(null);

    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);

    fetch(`/api/repositories?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed: ${r.status}`);
        return r.json() as Promise<PaginatedResponse<Repository>>;
      })
      .then((json) => {
        setRepos((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          const fresh = json.data.filter((r) => !seen.has(r.id));
          return [...prev, ...fresh];
        });
        setCursor(json.nextCursor);
        setHasMore(json.hasMore);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => {
  isLoadingMoreRef.current = false;
  setIsLoadingMore(false);
});
  }, [cursor, hasMore, isLoading, isLoadingMore, limit]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { repos, isLoading, isLoadingMore, hasMore, error, loadMore, refresh };
}