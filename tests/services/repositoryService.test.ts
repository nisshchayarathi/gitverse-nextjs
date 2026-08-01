import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/prisma", () => ({
  default: {
    repository: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    fileChange: {
      deleteMany: vi.fn(),
    },
    commit: {
      deleteMany: vi.fn(),
    },
    analysisJob: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../../lib/utils/ttlCache", () => ({
  ttlCache: {
    deleteByPrefix: vi.fn(),
  },
  TTL: {},
  repoStatsCacheKey: vi.fn(),
}));

import prisma from "../../lib/prisma";
import { ttlCache } from "../../lib/utils/ttlCache";
import { repositoryService } from "../../lib/services/repositoryService";
import { HttpError } from "../../lib/middleware";

describe("repositoryService.deleteRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws 404 when repository does not exist", async () => {
    (prisma.repository.findUnique as any).mockResolvedValue(null);

    await expect(
      repositoryService.deleteRepository(1, 42)
    ).rejects.toMatchObject({ status: 404 });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("throws 403 when repository belongs to another user", async () => {
    (prisma.repository.findUnique as any).mockResolvedValue({
      id: 1,
      userId: 99,
    });

    await expect(
      repositoryService.deleteRepository(1, 42)
    ).rejects.toMatchObject({ status: 403 });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("deletes repository and invalidates cache when owner matches", async () => {
    (prisma.repository.findUnique as any).mockResolvedValue({
      id: 1,
      userId: 42,
    });
    (prisma.$transaction as any).mockResolvedValue([]);

    const result = await repositoryService.deleteRepository(1, 42);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(ttlCache.deleteByPrefix).toHaveBeenCalledWith("repo-stats:1:");
    expect(result).toEqual({ success: true });
  });
});
