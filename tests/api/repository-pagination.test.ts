import { describe, it, expect, vi, beforeEach } from "vitest";
import { RepositoryService } from "../../lib/services/repositoryService";
import prisma from "../../lib/prisma";

vi.mock("../../lib/prisma", () => ({
  default: {
    repository: {
      findMany: vi.fn(),
    }
  }
}));

describe("Repository Pagination", () => {
  let repositoryService: RepositoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    repositoryService = new RepositoryService();
  });

  it("should query the database correctly on the first page load without a cursor", async () => {
    const mockRepos = Array.from({ length: 11 }, (_, i) => ({
      id: i + 1,
      name: `Repo ${i + 1}`,
      userId: 1,
    }));
    
    (prisma.repository.findMany as any).mockResolvedValue(mockRepos);

    const result = await repositoryService.listRepositories(1, 10);

    expect(prisma.repository.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 1 },
      take: 11,
      orderBy: { id: "desc" },
    }));

    expect(result.data).toHaveLength(10);
    expect(result.nextCursor).toBe(11);
    expect(result.hasMore).toBe(true);
  });

  it("should query the database correctly with a cursor on subsequent page loads", async () => {
    const mockRepos = Array.from({ length: 5 }, (_, i) => ({
      id: i + 12,
      name: `Repo ${i + 12}`,
      userId: 1,
    }));
    
    (prisma.repository.findMany as any).mockResolvedValue(mockRepos);

    const result = await repositoryService.listRepositories(1, 10, 11);

    expect(prisma.repository.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 1 },
      take: 11,
      cursor: { id: 11 },
      skip: 1,
      orderBy: { id: "desc" },
    }));

    expect(result.data).toHaveLength(5);
    expect(result.nextCursor).toBeUndefined();
    expect(result.hasMore).toBe(false);
  });
});
