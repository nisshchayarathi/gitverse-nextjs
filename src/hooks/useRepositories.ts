import { useState, useCallback, useEffect, useRef } from "react";
import axios from "axios";
import { buildApiUrl } from "../services/apiConfig";

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
  const cursorRef = useRef<number | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFetchingRef = useRef<boolean>(false);
  const initRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchRepos = useCallback(async (isLoadMore = false) => {
    // Concurrency lock: Prevent duplicate requests
    if (isFetchingRef.current) return;

    // Prevent loadMore if no more items
    if (isLoadMore && !hasMore) return;

    // Abort any in-flight request before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    isFetchingRef.current = true;

    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    setError(null);

    try {
      const token = localStorage.getItem("gitverse_token");
      const url = new URL(buildApiUrl("/api/repositories"));
      url.searchParams.set("limit", limit.toString());

      if (isLoadMore && cursorRef.current !== undefined) {
        url.searchParams.set("cursor", cursorRef.current.toString());
      }

      const response = await axios.get(url.toString(), {
        headers: {
          Authorization: "Bearer ",
        },
        signal: controller.signal,
      });

      // apiSuccess wraps response in { error, data: { repositories, nextCursor, hasMore } }
      const { repositories, nextCursor: newCursor, hasMore: newHasMore } = response.data.data || {};

      const newRepos = Array.isArray(repositories) ? repositories : [];

      setRepos((prev) => {
        if (!isLoadMore) return newRepos;

        const existingIds = new Set(prev.map((r) => r.id));
        const filtered = newRepos.filter((r: Repository) => !existingIds.has(r.id));

        return [...prev, ...filtered];
      });

      cursorRef.current = newCursor;
      setHasMore(newHasMore);
    } catch (err: any) {
      if (err.name !== "CanceledError" && err.name !== "AbortError" && !axios.isCancel(err)) {
        setError(err.response?.data?.error || err.message || "Failed to fetch repositories.");
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
        setIsLoadingMore(false);
        isFetchingRef.current = false;
      }
    }
  }, [hasMore, limit]);

  // CLEAN useEffect (no duplicate fetch logic)
  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      fetchRepos();
    }

    // Cleanup: abort in-flight request when component unmounts
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchRepos]);

  const loadMore = useCallback(async () => {
    await fetchRepos(true);
  }, [fetchRepos]);

  const refresh = useCallback(async () => {
    cursorRef.current = undefined;
    setHasMore(true);
    await fetchRepos(false);
  }, [fetchRepos]);

  return { repos, isLoading, isLoadingMore, hasMore, error, loadMore, refresh };
}
