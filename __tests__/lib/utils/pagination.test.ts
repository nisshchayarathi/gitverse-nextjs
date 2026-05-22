import { describe, it, expect } from "vitest";
import {
  parsePaginationParams,
  buildPaginatedResponse,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MIN_LIMIT,
} from "../../../lib/utils/pagination";

// ---------------------------------------------------------------------------
// parsePaginationParams
// ---------------------------------------------------------------------------
describe("parsePaginationParams", () => {
  function params(query: Record<string, string>): URLSearchParams {
    return new URLSearchParams(query);
  }

  it("returns defaults when no params are provided", () => {
    const result = parsePaginationParams(params({}));
    expect(result).toEqual({ limit: DEFAULT_LIMIT, cursor: null });
  });

  it("parses a valid limit", () => {
    const result = parsePaginationParams(params({ limit: "10" }));
    expect(result.limit).toBe(10);
  });

  it("parses a valid cursor", () => {
    const result = parsePaginationParams(params({ cursor: "42" }));
    expect(result.cursor).toBe(42);
  });

  it("parses limit and cursor together", () => {
    const result = parsePaginationParams(params({ limit: "5", cursor: "99" }));
    expect(result).toEqual({ limit: 5, cursor: 99 });
  });

  // --- limit clamping ---

  it("clamps limit to MAX_LIMIT when too high", () => {
    const result = parsePaginationParams(params({ limit: "999" }));
    expect(result.limit).toBe(MAX_LIMIT);
  });

  it("clamps limit to MIN_LIMIT when too low", () => {
    const result = parsePaginationParams(params({ limit: "0" }));
    expect(result.limit).toBe(MIN_LIMIT);
  });

  it("clamps negative limit to MIN_LIMIT", () => {
    const result = parsePaginationParams(params({ limit: "-5" }));
    expect(result.limit).toBe(MIN_LIMIT);
  });

  it("floors fractional limit values", () => {
    const result = parsePaginationParams(params({ limit: "7.9" }));
    expect(result.limit).toBe(7);
  });

  // --- invalid values ---

  it("ignores non-numeric limit", () => {
    const result = parsePaginationParams(params({ limit: "abc" }));
    expect(result.limit).toBe(DEFAULT_LIMIT);
  });

  it("ignores non-numeric cursor", () => {
    const result = parsePaginationParams(params({ cursor: "abc" }));
    expect(result.cursor).toBeNull();
  });

  it("ignores negative cursor", () => {
    const result = parsePaginationParams(params({ cursor: "-1" }));
    expect(result.cursor).toBeNull();
  });

  it("ignores zero cursor", () => {
    const result = parsePaginationParams(params({ cursor: "0" }));
    expect(result.cursor).toBeNull();
  });

  it("floors fractional cursor values", () => {
    const result = parsePaginationParams(params({ cursor: "5.7" }));
    expect(result.cursor).toBe(5);
  });

  it("ignores Infinity limit", () => {
    const result = parsePaginationParams(params({ limit: "Infinity" }));
    expect(result.limit).toBe(DEFAULT_LIMIT);
  });

  it("ignores NaN cursor", () => {
    const result = parsePaginationParams(params({ cursor: "NaN" }));
    expect(result.cursor).toBeNull();
  });

  it("ignores empty string limit", () => {
    const result = parsePaginationParams(params({ limit: "" }));
    expect(result.limit).toBe(DEFAULT_LIMIT);
  });

  it("ignores empty string cursor", () => {
    const result = parsePaginationParams(params({ cursor: "" }));
    expect(result.cursor).toBeNull();
  });

  it("ignores whitespace-only limit", () => {
    const result = parsePaginationParams(params({ limit: "   " }));
    expect(result.limit).toBe(DEFAULT_LIMIT);
  });

  it("ignores whitespace-only cursor", () => {
    const result = parsePaginationParams(params({ cursor: "   " }));
    expect(result.cursor).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildPaginatedResponse
// ---------------------------------------------------------------------------
describe("buildPaginatedResponse", () => {
  it("handles empty results", () => {
    const result = buildPaginatedResponse([], 20);

    expect(result).toEqual({
      data: [],
      pagination: {
        nextCursor: null,
        hasMore: false,
        limit: 20,
      },
    });
  });

  it("returns all items when fewer than limit", () => {
    const items = [
      { id: 1, name: "a" },
      { id: 2, name: "b" },
    ];
    const result = buildPaginatedResponse(items, 5);

    expect(result.data).toHaveLength(2);
    expect(result.pagination.hasMore).toBe(false);
    expect(result.pagination.nextCursor).toBeNull();
  });

  it("returns all items when exactly equal to limit", () => {
    const items = [
      { id: 1, name: "a" },
      { id: 2, name: "b" },
      { id: 3, name: "c" },
    ];
    const result = buildPaginatedResponse(items, 3);

    expect(result.data).toHaveLength(3);
    expect(result.pagination.hasMore).toBe(false);
    expect(result.pagination.nextCursor).toBeNull();
  });

  it("trims sentinel row and sets hasMore when items > limit", () => {
    const items = [
      { id: 10, name: "a" },
      { id: 11, name: "b" },
      { id: 12, name: "c" },
      { id: 13, name: "d" }, // sentinel row
    ];
    const result = buildPaginatedResponse(items, 3);

    expect(result.data).toHaveLength(3);
    expect(result.data.map((d) => d.id)).toEqual([10, 11, 12]);
    expect(result.pagination.hasMore).toBe(true);
    expect(result.pagination.nextCursor).toBe(12);
  });

  it("sets nextCursor to the id of the last visible item", () => {
    const items = [
      { id: 50, name: "x" },
      { id: 51, name: "y" }, // sentinel
    ];
    const result = buildPaginatedResponse(items, 1);

    expect(result.data).toHaveLength(1);
    expect(result.pagination.nextCursor).toBe(50);
    expect(result.pagination.hasMore).toBe(true);
  });

  it("preserves the limit value in the response", () => {
    const result = buildPaginatedResponse([], 42);
    expect(result.pagination.limit).toBe(42);
  });

  it("works with a single item and limit=1 (no more)", () => {
    const items = [{ id: 1, name: "only" }];
    const result = buildPaginatedResponse(items, 1);

    expect(result.data).toHaveLength(1);
    expect(result.pagination.hasMore).toBe(false);
    expect(result.pagination.nextCursor).toBeNull();
  });

  it("throws an error when limit is 0 or negative or invalid", () => {
    expect(() => buildPaginatedResponse([], 0)).toThrow("Limit must be a positive, finite integer");
    expect(() => buildPaginatedResponse([], -5)).toThrow("Limit must be a positive, finite integer");
    expect(() => buildPaginatedResponse([], NaN)).toThrow("Limit must be a positive, finite integer");
    expect(() => buildPaginatedResponse([], Infinity)).toThrow("Limit must be a positive, finite integer");
  });
});
