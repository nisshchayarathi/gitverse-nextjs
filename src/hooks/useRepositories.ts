import { useState, useCallback, useEffect, useRef } from "react";
import axios from "axios";
import { buildApiUrl } from "@/services/apiConfig";

export interface Repository {
  id: string;
  name: string;
  url: string;
  description?: string;
  language?: string;
  lastAnalyzed?: string;
  stars?: number;
  commits?: number;
  contributors?: number;
  status?: "completed" | "processing" | "failed";
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

interface UseRepositoriesReturn {
  repos: Repository[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

const DEFAULT_LIMIT = 10;

export function useRepositories({ limit = DEFAULT_LIMIT } = {}): UseRepositoriesReturn {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFetchingRef = useRef(false);

  const fetchRepos = useCallback(
    async (isLoadMore = false) => {
      if (isFetchingRef.current) return;
      if (isLoadMore && !hasMore) return;

      isFetchingRef.current = true;

      if (isLoadMore) setIsLoadingMore(true);
      else setIsLoading(true);

      setError(null);

      try {
        const token = localStorage.getItem("gitverse_token");

        const url = new URL(buildApiUrl("/api/repositories"));
        url.searchParams.set("limit", limit.toString());

        if (isLoadMore && cursor !== undefined) {
          url.searchParams.set("cursor", cursor.toString());
        }

        const response = await axios.get(url.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const { data, nextCursor, hasMore: newHasMore } = response.data;

        const newRepos = Array.isArray(data) ? data : [];

        setRepos((prev) => {
          if (!isLoadMore) return newRepos;

          const existingIds = new Set(prev.map((r) => r.id));
          const filtered = newRepos.filter((r: Repository) => !existingIds.has(r.id));

          return [...prev, ...filtered];
        });

        setCursor(nextCursor);
        setHasMore(newHasMore);
      } catch (err: any) {
        if (err.name !== "CanceledError" && err.name !== "AbortError") {
          setError(err.response?.data?.error || err.message || "Failed to fetch repositories.");
        }
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
        isFetchingRef.current = false;
      }
    },
    [cursor, hasMore, limit]
  );

  // ✅ CLEAN useEffect (no duplicate fetch logic)
  useEffect(() => {
    fetchRepos(false);
  }, [fetchRepos]);

  const loadMore = useCallback(async () => {
    await fetchRepos(true);
  }, [fetchRepos]);

  const refresh = useCallback(async () => {
    setCursor(undefined);
    setHasMore(true);
    await fetchRepos(false);
  }, [fetchRepos]);

  return {
    repos,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
  };
}