"use client";

import React, { useEffect, useRef } from "react";
import { useUsers } from "@/hooks/useUsers";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";

interface UserListProps {
  /** Number of users per page (default: 20). */
  limit?: number;
  /** When true the component uses an IntersectionObserver for infinite scroll
   *  instead of a manual "Load more" button. */
  infiniteScroll?: boolean;
}

/**
 * Displays a paginated list of users.
 *
 * Supports two pagination modes:
 *  - infiniteScroll (default: false) — loads the next page automatically when
 *    the sentinel element scrolls into view.
 *  - button mode — shows a "Load more" button at the bottom.
 */
export function UserList({ limit = 20, infiniteScroll = false }: UserListProps) {
  const { users, isLoading, isLoadingMore, error, hasMore, loadMore } =
    useUsers({ limit });

  // Sentinel element for IntersectionObserver-based infinite scroll.
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!infiniteScroll) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [infiniteScroll, hasMore, isLoadingMore, loadMore]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16" role="status" aria-label="Loading users">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        role="alert"
      >
        <p className="font-medium">Failed to load users</p>
        <p className="mt-1 text-destructive/80">{error}</p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="py-16 text-center text-secondary-500 dark:text-secondary-400">
        No users found.
      </div>
    );
  }

  return (
    <section aria-label="User list">
      <ul className="divide-y divide-border rounded-md border border-border" role="list">
        {users.map((user) => (
          <li
            key={user.id}
            className="flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors"
          >
            {/* Avatar */}
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
              aria-hidden="true"
            >
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>

            {/* Details */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {user.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>

            {/* Joined date */}
            <time
              dateTime={user.createdAt}
              className="shrink-0 text-xs text-muted-foreground"
            >
              {new Date(user.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </time>
          </li>
        ))}
      </ul>

      {/* Infinite scroll sentinel */}
      {infiniteScroll && <div ref={sentinelRef} aria-hidden="true" />}

      {/* Load more button (non-infinite-scroll mode) */}
      {!infiniteScroll && hasMore && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={isLoadingMore}
            aria-label="Load more users"
          >
            {isLoadingMore ? (
              <>
                <Spinner size="sm" color="primary" />
                <span>Loading…</span>
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}

      {/* Inline spinner for infinite scroll loading state */}
      {infiniteScroll && isLoadingMore && (
        <div className="flex justify-center py-4" role="status" aria-label="Loading more users">
          <Spinner size="md" />
        </div>
      )}

      {/* End-of-list indicator */}
      {!hasMore && users.length > 0 && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          All {users.length} user{users.length !== 1 ? "s" : ""} loaded
        </p>
      )}
    </section>
  );
}
