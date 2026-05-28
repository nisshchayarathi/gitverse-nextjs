import { useState, useEffect, useCallback, useRef } from "react";

type ViewMode = "grid" | "list";
type SortBy = "recent" | "stars" | "name";

interface RepoBrowsePrefs {
  viewMode: ViewMode;
  sortBy: SortBy;
}

const STORAGE_KEY = "gitverse_repo_browse_prefs";
const VALID_VIEW_MODES: ViewMode[] = ["grid", "list"];
const VALID_SORT_OPTIONS: SortBy[] = ["recent", "stars", "name"];

const DEFAULTS: RepoBrowsePrefs = {
  viewMode: "grid",
  sortBy: "recent",
};

function loadPrefs(): RepoBrowsePrefs {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULTS;

    const parsed = JSON.parse(stored) as Partial<RepoBrowsePrefs>;

    const viewMode: ViewMode = VALID_VIEW_MODES.includes(parsed.viewMode as ViewMode)
      ? (parsed.viewMode as ViewMode)
      : DEFAULTS.viewMode;

    const sortBy: SortBy = VALID_SORT_OPTIONS.includes(parsed.sortBy as SortBy)
      ? (parsed.sortBy as SortBy)
      : DEFAULTS.sortBy;

    return { viewMode, sortBy };
  } catch {
    return DEFAULTS;
  }
}

function savePrefs(prefs: RepoBrowsePrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    console.log("Failed to save preferences — localStorage unavailable");
  }
}

/**
 * Persists the repository browse page preferences (view mode + sort order)
 * in localStorage across page reloads and navigation.
 *
 * Safe to use in Next.js:
 *  - localStorage is only accessed after mount (client-side)
 *  - Invalid or stale stored values fall back to defaults silently
 */
export function useRepoBrowsePrefs() {
  const [viewMode, setViewModeState] = useState<ViewMode>(DEFAULTS.viewMode);
  const [sortBy, setSortByState] = useState<SortBy>(DEFAULTS.sortBy);

  // Refs always hold the latest committed values — used in callbacks to avoid
  // stale closures and the functional-updater side-effect anti-pattern.
  const viewModeRef = useRef<ViewMode>(DEFAULTS.viewMode);
  const sortByRef = useRef<SortBy>(DEFAULTS.sortBy);

  // Load persisted values from localStorage after mount (SSR-safe)
  useEffect(() => {
    const prefs = loadPrefs();
    viewModeRef.current = prefs.viewMode;
    sortByRef.current = prefs.sortBy;
    setViewModeState(prefs.viewMode);
    setSortByState(prefs.sortBy);
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    viewModeRef.current = mode;
    setViewModeState(mode);
    savePrefs({ viewMode: mode, sortBy: sortByRef.current });
  }, []);

  const setSortBy = useCallback((sort: SortBy) => {
    sortByRef.current = sort;
    setSortByState(sort);
    savePrefs({ viewMode: viewModeRef.current, sortBy: sort });
  }, []);

  return { viewMode, setViewMode, sortBy, setSortBy };
}
