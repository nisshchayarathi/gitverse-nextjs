/**
 * Unit tests for RepositoryService.listRepositories search functionality.
 *
 * Verifies that the search parameter correctly builds Prisma where clauses
 * for case-insensitive filtering on name and url fields, and that pagination
 * (cursor, hasMore, totalCount) works correctly alongside search.
 */

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    repository: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Mock all transitive imports that repositoryService pulls in
jest.mock("@/lib/services/gitService", () => ({
  GitService: jest.fn(),
}));
jest.mock("@/lib/services/geminiAnalysisCacheService", () => ({
  invalidateCacheForCommit: jest.fn(),
  invalidateExpiredCacheEntries: jest.fn(),
  invalidateGeminiAnalysisCacheForRepository: jest.fn(),
}));
jest.mock("@/lib/utils/ttlCache", () => ({
  ttlCache: { get: jest.fn(), set: jest.fn(), delete: jest.fn() },
  TTL: {},
  repoStatsCacheKey: jest.fn(),
}));
jest.mock("@/lib/utils/concurrencyLimiter", () => ({
  repoSyncLimiter: { schedule: jest.fn((fn: any) => fn()) },
}));
jest.mock("@/lib/utils/dbRetry", () => ({
  withDbRetry: jest.fn((fn: any) => fn()),
}));

const prisma = require("@/lib/prisma").default;

// Import after mocks are set up
import { repositoryService } from "@/lib/services/repositoryService";

describe("RepositoryService.listRepositories", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockRepo = (id: number, name: string, url: string) => ({
    id,
    name,
    url,
    _count: { commits: 5, contributors: 2, files: 10, branches: 1, subPackages: 0 },
    languages: [{ name: "TypeScript", percentage: 80 }],
    parent: null,
  });

  it("fetches all repositories without search filter", async () => {
    const repos = [mockRepo(3, "my-app", "https://github.com/user/my-app")];
    prisma.repository.findMany.mockResolvedValue(repos);
    prisma.repository.count.mockResolvedValue(1);

    const result = await repositoryService.listRepositories(1, 10);

    // Verify where clause has no OR (no search)
    expect(prisma.repository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1 },
        take: 11,
        orderBy: { id: "desc" },
      }),
    );
    expect(prisma.repository.count).toHaveBeenCalledWith({
      where: { userId: 1 },
    });

    expect(result.data).toEqual(repos);
    expect(result.hasMore).toBe(false);
    expect(result.totalCount).toBe(1);
  });

  it("applies case-insensitive search filter on name and url", async () => {
    prisma.repository.findMany.mockResolvedValue([]);
    prisma.repository.count.mockResolvedValue(0);

    await repositoryService.listRepositories(1, 10, undefined, "react");

    const expectedWhere = {
      userId: 1,
      OR: [
        { name: { contains: "react", mode: "insensitive" } },
        { url: { contains: "react", mode: "insensitive" } },
      ],
    };

    expect(prisma.repository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
    expect(prisma.repository.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it("trims search whitespace", async () => {
    prisma.repository.findMany.mockResolvedValue([]);
    prisma.repository.count.mockResolvedValue(0);

    await repositoryService.listRepositories(1, 10, undefined, "  next  ");

    expect(prisma.repository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: "next", mode: "insensitive" } },
            { url: { contains: "next", mode: "insensitive" } },
          ],
        }),
      }),
    );
  });

  it("ignores empty or whitespace-only search", async () => {
    prisma.repository.findMany.mockResolvedValue([]);
    prisma.repository.count.mockResolvedValue(0);

    await repositoryService.listRepositories(1, 10, undefined, "   ");

    expect(prisma.repository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1 },
      }),
    );
  });

  it("returns correct hasMore and nextCursor when there are more results", async () => {
    // With limit 2, return 3 items (one extra) to indicate hasMore
    const repos = [
      mockRepo(5, "repo-c", "https://github.com/user/repo-c"),
      mockRepo(4, "repo-b", "https://github.com/user/repo-b"),
      mockRepo(3, "repo-a", "https://github.com/user/repo-a"),
    ];
    prisma.repository.findMany.mockResolvedValue([...repos]);
    prisma.repository.count.mockResolvedValue(10);

    const result = await repositoryService.listRepositories(1, 2);

    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe(3);
    expect(result.data).toHaveLength(2);
    expect(result.totalCount).toBe(10);
  });

  it("passes cursor and skip when cursor is provided", async () => {
    prisma.repository.findMany.mockResolvedValue([]);
    prisma.repository.count.mockResolvedValue(0);

    await repositoryService.listRepositories(1, 10, 42);

    expect(prisma.repository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 42 },
        skip: 1,
      }),
    );
  });

  it("combines cursor with search", async () => {
    prisma.repository.findMany.mockResolvedValue([]);
    prisma.repository.count.mockResolvedValue(0);

    await repositoryService.listRepositories(1, 5, 100, "api");

    const call = prisma.repository.findMany.mock.calls[0][0];
    expect(call.where).toEqual({
      userId: 1,
      OR: [
        { name: { contains: "api", mode: "insensitive" } },
        { url: { contains: "api", mode: "insensitive" } },
      ],
    });
    expect(call.cursor).toEqual({ id: 100 });
    expect(call.skip).toBe(1);
    expect(call.take).toBe(6);
  });
});
