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

interface UseRepositoriesOptions {
  limit?: number;
  search?: string;
}

interface UseRepositoriesReturn {
  repos: Repository[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  totalCount: number;
  error: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

const DEFAULT_LIMIT = 15;
const SEARCH_DEBOUNCE_MS = 300;

export function useRepositories({
  limit = DEFAULT_LIMIT,
  search = "",
}: UseRepositoriesOptions = {}): UseRepositoriesReturn {
  const [repos, setRepos] = useState<Repository[]>([]);
  const cursorRef = useRef<number | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFetchingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track the last search term we actually fetched for
  const lastSearchRef = useRef<string>(search);

  const fetchRepos = useCallback(
    async (isLoadMore = false) => {
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

        if (search && search.trim().length > 0) {
          url.searchParams.set("search", search.trim());
        }

        const response = await axios.get(url.toString(), {
          headers: {
            Authorization: "Bearer ",
          },
          signal: controller.signal,
        });

        // apiSuccess wraps response in { error, data: { repositories, nextCursor, hasMore, totalCount } }
        const {
          repositories,
          nextCursor: newCursor,
          hasMore: newHasMore,
          totalCount: newTotalCount,
        } = response.data.data || {};

        const newRepos = Array.isArray(repositories) ? repositories : [];

        setRepos((prev) => {
          if (!isLoadMore) return newRepos;

          const existingIds = new Set(prev.map((r) => r.id));
          const filtered = newRepos.filter(
            (r: Repository) => !existingIds.has(r.id),
          );

          return [...prev, ...filtered];
        });

        cursorRef.current = newCursor;
        setHasMore(newHasMore);
        setTotalCount(newTotalCount ?? 0);
      } catch (err: any) {
        if (
          err.name !== "CanceledError" &&
          err.name !== "AbortError" &&
          !axios.isCancel(err)
        ) {
          setError(
            err.response?.data?.error ||
              err.message ||
              "Failed to fetch repositories.",
          );
        }
      } finally {
        if (abortControllerRef.current === controller) {
          setIsLoading(false);
          setIsLoadingMore(false);
          isFetchingRef.current = false;
        }
      }
    },
    [hasMore, limit, search],
  );

  // Initial fetch + re-fetch when search changes (debounced)
  useEffect(() => {
    // If search changed, debounce the reset+fetch
    if (search !== lastSearchRef.current) {
      lastSearchRef.current = search;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        cursorRef.current = undefined;
        setHasMore(true);
        isFetchingRef.current = false;
        fetchRepos(false);
      }, SEARCH_DEBOUNCE_MS);
    } else {
      // Initial mount fetch
      cursorRef.current = undefined;
      setHasMore(true);
      fetchRepos(false);
    }

    // Cleanup: abort in-flight request when component unmounts
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(async () => {
    await fetchRepos(true);
  }, [fetchRepos]);

  const refresh = useCallback(async () => {
    cursorRef.current = undefined;
    setHasMore(true);
    isFetchingRef.current = false;
    await fetchRepos(false);
  }, [fetchRepos]);

  return {
    repos,
    isLoading,
    isLoadingMore,
    hasMore,
    totalCount,
    error,
    loadMore,
    refresh,
  };
}
