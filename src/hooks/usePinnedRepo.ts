import { useState, useCallback } from "react";
import axios from "axios";
import { buildApiUrl } from "@/services/apiConfig";

interface UsePinnedRepoReturn {
  isPinned: boolean;
  isLoading: boolean;
  togglePin: () => Promise<void>;
}

export function usePinnedRepo(
  repoId: number,
  initialPinnedState: boolean,
): UsePinnedRepoReturn {
  const [isPinned, setIsPinned] = useState(initialPinnedState);
  const [isLoading, setIsLoading] = useState(false);

  const togglePin = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);

    // Optimistic update
    setIsPinned((prev) => !prev);

    try {
      const token = localStorage.getItem("gitverse_token");
      const response = await axios.patch(
        buildApiUrl(`/api/repositories/${repoId}/pin`),
        {},
        {
          withCredentials: true,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      );
      // Sync with server response
      setIsPinned(response.data.isPinned);
    } catch (error) {
      // Revert on error
      setIsPinned((prev) => !prev);
      console.error("Failed to toggle pin:", error);
    } finally {
      setIsLoading(false);
    }
  }, [repoId, isLoading]);

  return { isPinned, isLoading, togglePin };
}
