/**
 * Reusable cursor-based pagination utilities.
 *
 * Design:
 *  - Cursor = the `id` of the last item the client already has.
 *  - We fetch `limit + 1` rows with `id > cursor` to detect whether
 *    another page exists — no extra COUNT(*) query needed.
 *  - Limit is clamped to [1, MAX_LIMIT] with a sensible default.
 */

import type {
  PaginationParams,
  PaginatedResponse,
  PaginationMeta,
} from "../../types/pagination";

// Re-export types for convenience
export type { PaginationParams, PaginatedResponse, PaginationMeta };

/** Default number of items per page when the caller does not specify `limit`. */
export const DEFAULT_LIMIT = 20;
/** Absolute maximum items per page (prevents abuse). */
export const MAX_LIMIT = 100;
/** Absolute minimum items per page. */
export const MIN_LIMIT = 1;

/**
 * Parse and validate pagination query-string parameters.
 *
 * @param searchParams - The `URLSearchParams` from the incoming request.
 * @returns Validated `{ limit, cursor }`.
 *
 * @example
 * ```ts
 * const url = new URL(request.url);
 * const { limit, cursor } = parsePaginationParams(url.searchParams);
 * ```
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
): PaginationParams {
  // --- limit ---
  const rawLimit = searchParams.get("limit");
  let limit = DEFAULT_LIMIT;

  if (rawLimit !== null) {
    const parsed = Number(rawLimit);
    if (Number.isFinite(parsed)) {
      limit = Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, Math.floor(parsed)));
    }
  }

  // --- cursor ---
  const rawCursor = searchParams.get("cursor");
  let cursor: number | null = null;

  if (rawCursor !== null) {
    const parsed = Number(rawCursor);
    if (Number.isFinite(parsed) && parsed > 0) {
      cursor = Math.floor(parsed);
    }
  }

  return { limit, cursor };
}

/**
 * Build a standardised paginated response envelope.
 *
 * Pass in the items returned from the database (fetched with `take: limit + 1`)
 * along with the effective `limit`. The function trims the extra sentinel row
 * and derives the `hasMore` / `nextCursor` fields automatically.
 *
 * @param items  - Rows fetched with `take: limit + 1`. Each must have a numeric `id`.
 * @param limit  - The effective page-size limit (after clamping).
 * @returns A `PaginatedResponse<T>` ready to be serialised as JSON.
 *
 * @example
 * ```ts
 * const rows = await prisma.user.findMany({ take: limit + 1, ... });
 * return NextResponse.json(buildPaginatedResponse(rows, limit));
 * ```
 */
export function buildPaginatedResponse<T extends { id: number }>(
  items: T[],
  limit: number,
): PaginatedResponse<T> {
  const hasMore = items.length > limit;

  // Trim the sentinel row so the consumer only sees `limit` items.
  const data = hasMore ? items.slice(0, limit) : items;

  const lastItem = data[data.length - 1] as T | undefined;
  const nextCursor = hasMore && lastItem ? lastItem.id : null;

  return {
    data,
    pagination: {
      nextCursor,
      hasMore,
      limit,
    },
  };
}
