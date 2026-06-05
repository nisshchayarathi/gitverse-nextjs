// `jest.mock` factories are hoisted, so these bindings need `var` for
// initialization from the mocked modules before the route import runs.
var mockRequireAuth = jest.fn();
var mockIsHttpError = jest.fn();
var mockPrisma: any;

jest.mock("@/lib/middleware", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  isHttpError: (...args: unknown[]) => mockIsHttpError(...args),
  sanitizeError: jest.fn((error) => error),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: (mockPrisma = {
    $transaction: jest.fn(),
    gitHubRepo: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
  }),
}));

jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn((body, init) => ({
      status: init?.status ?? 200,
      json: async () => body,
    })),
  },
}));

import { POST } from "../../app/api/integrations/github/select-repos/route";

function createJsonRequest(body: unknown) {
  return {
    json: jest.fn().mockResolvedValue(body),
  };
}

describe("POST /api/integrations/github/select-repos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ userId: 42 });
    mockIsHttpError.mockReturnValue(false);
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockPrisma) => Promise<unknown>) =>
        callback(mockPrisma),
    );
  });

  it("rejects repositories that were not discovered from the user's GitHub App installation", async () => {
    mockPrisma.gitHubRepo.findMany.mockResolvedValueOnce([]);

    const response = await POST(
      createJsonRequest({ repoFullNames: ["victim-org/private-repo"] }) as any,
    );

    await expect(response.json()).resolves.toEqual({
      error:
        "Selected repositories must be installed through the GitHub App first",
      unavailableRepoFullNames: ["victim-org/private-repo"],
    });
    expect(response.status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.gitHubRepo.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.gitHubRepo.upsert).not.toHaveBeenCalled();
  });

  it("enables only trusted installation-backed repository rows", async () => {
    const returnedRepo = {
      id: 1,
      repoFullName: "owner/repo",
      enabled: true,
      installationId: BigInt(123),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    mockPrisma.gitHubRepo.findMany
      .mockResolvedValueOnce([{ repoFullName: "owner/repo" }])
      .mockResolvedValueOnce([returnedRepo]);

    const response = await POST(
      createJsonRequest({ repoFullNames: ["owner/repo", "owner/repo"] }) as any,
    );

    await expect(response.json()).resolves.toEqual({
      repos: [
        {
          ...returnedRepo,
          installationId: "123",
        },
      ],
    });
    expect(response.status).toBe(200);
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(mockPrisma.gitHubRepo.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        userId: 42,
        repoFullName: { in: ["owner/repo"] },
        installationId: { not: null },
      },
      data: { enabled: true },
    });
    expect(mockPrisma.gitHubRepo.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        userId: 42,
        repoFullName: { notIn: ["owner/repo"] },
      },
      data: { enabled: false },
    });
    expect(mockPrisma.gitHubRepo.upsert).not.toHaveBeenCalled();
  });
});
