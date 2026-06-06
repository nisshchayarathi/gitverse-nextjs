"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "gitverse-bookmarked-modules";

export type BookmarkedModules = string[];

export function useModuleBookmarks() {
  const [bookmarkedModules, setBookmarkedModules] = useState<BookmarkedModules>(
    []
  );

  // Load bookmarks on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const savedValue = window.localStorage.getItem(STORAGE_KEY);
      if (savedValue) {
        const parsed = JSON.parse(savedValue) as BookmarkedModules;
        if (Array.isArray(parsed)) {
          setBookmarkedModules(parsed);
        }
      }
    } catch {
      setBookmarkedModules([]);
    }
  }, []);

  // Persist bookmarks to localStorage whenever they change
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarkedModules));
  }, [bookmarkedModules]);

  const addBookmark = (moduleName: string) => {
    setBookmarkedModules((current) => {
      // Prevent duplicates
      if (current.includes(moduleName)) {
        return current;
      }
      return [...current, moduleName];
    });
  };

  const removeBookmark = (moduleName: string) => {
    setBookmarkedModules((current) =>
      current.filter((name) => name !== moduleName)
    );
  };

  const toggleBookmark = (moduleName: string) => {
    if (bookmarkedModules.includes(moduleName)) {
      removeBookmark(moduleName);
    } else {
      addBookmark(moduleName);
    }
  };

  const isBookmarked = (moduleName: string) => {
    return bookmarkedModules.includes(moduleName);
  };

  return {
    bookmarkedModules,
    addBookmark,
    removeBookmark,
    toggleBookmark,
    isBookmarked,
  };
}
