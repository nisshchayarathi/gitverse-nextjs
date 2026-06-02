import { useState, useEffect, useCallback } from "react";

export interface RecentRepository {
  owner: string;
  name: string;
  url: string;
  analyzedAt: number;
}

const LOCAL_STORAGE_KEY = "gitverse_recent_repositories";

export function useRecentRepos() {
  const [repos, setRepos] = useState<RecentRepository[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Safely initialize from localStorage only after mounting on the client
  useEffect(() => {
  const controller = new AbortController();
  let isMounted = true;

  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);

    if (!controller.signal.aborted && isMounted) {
      if (stored) {
        setRepos(JSON.parse(stored));
      }
      setIsLoaded(true);
    }
  } catch (error) {
    if (!controller.signal.aborted && isMounted) {
      console.error(
        "Failed to load recent repositories from localStorage",
        error
      );
      setIsLoaded(true);
    }
  }

  return () => {
    isMounted = false;
    controller.abort();
  };
}, []);

  // Adds a repository to the top, removes duplicates, and limits length to 5
  const addRepo = useCallback((newRepo: Omit<RecentRepository, "analyzedAt">) => {
    setRepos((prevRepos) => {
      const repoToAdd: RecentRepository = {
        ...newRepo,
        analyzedAt: Date.now(),
      };

      // Exclude duplicate entries matching URL (case-insensitive, trimmed)
      const filtered = prevRepos.filter(
        (r) => r.url.toLowerCase().trim() !== repoToAdd.url.toLowerCase().trim()
      );

      // Prepend the new one and limit the size to a maximum of 5 items
      const updated = [repoToAdd, ...filtered].slice(0, 5);

      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to save recent repositories to localStorage", error);
      }

      return updated;
    });
  }, []);

  // Returns the list of recent repositories
  const getRepos = useCallback(() => {
    return repos;
  }, [repos]);

  // Clears the history
  const clearRepos = useCallback(() => {
    setRepos([]);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear recent repositories from localStorage", error);
    }
  }, []);

  return {
    repos,
    addRepo,
    getRepos,
    clearRepos,
    isLoaded,
  };
}
