import { useState, useCallback, useEffect, useRef } from "react";
import { buildApiUrl } from "../services/apiConfig";

export interface Tag {
  id: string;
  name: string;
  color: string;
  _count?: {
    repos: number;
  };
}

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);

  const fetchTags = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = buildApiUrl("/api/users/tags");
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch tags");
      }
      const data = await response.json();
      setTags(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch tags");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      fetchTags();
    }
  }, [fetchTags]);

  const createTag = async (name: string, color: string) => {
    try {
      const url = buildApiUrl("/api/users/tags");
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      if (!response.ok) {
        throw new Error("Failed to create tag");
      }
      const newTag = await response.json();
      setTags(prev => [...prev, newTag]);
      return newTag;
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  };

  const updateTag = async (id: string, name?: string, color?: string) => {
    try {
      const url = buildApiUrl("/api/users/tags");
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, color }),
      });
      if (!response.ok) {
        throw new Error("Failed to update tag");
      }
      const updatedTag = await response.json();
      setTags(prev => prev.map(t => t.id === id ? { ...t, ...updatedTag } : t));
      return updatedTag;
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  };

  const deleteTag = async (id: string) => {
    try {
      const url = buildApiUrl("/api/users/tags");
      const response = await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        throw new Error("Failed to delete tag");
      }
      setTags(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  };

  return { tags, setTags, isLoading, error, refresh: fetchTags, createTag, updateTag, deleteTag };
}
