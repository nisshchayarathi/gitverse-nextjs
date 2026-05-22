/**
 * Shared pagination types used across API routes and frontend consumers.
 *
 * The project uses cursor-based pagination (keyset pagination) with
 * auto-increment integer IDs. This avoids the offset-drift problem of
 * traditional page-number pagination and scales well with large tables.
 */

/** Metadata block returned alongside every paginated list. */
export interface PaginationMeta {
  /** ID of the last item on the current page; pass as `cursor` to fetch the next page. `null` when there are no results. */
  nextCursor: number | null;
  /** `true` when at least one more page exists after the current one. */
  hasMore: boolean;
  /** The limit that was applied (after clamping). */
  limit: number;
}

/** Parsed & validated pagination parameters from the request query string. */
export interface PaginationParams {
  /** Maximum number of items to return (1–100, default 20). */
  limit: number;
  /** Exclusive lower-bound cursor; only items with `id > cursor` are returned. `null` for the first page. */
  cursor: number | null;
}

/** Envelope returned by every paginated API endpoint. */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}
