import { DeploymentAnalysisService } from "../deployment-analysis";

jest.mock("../githubService", () => ({
  githubService: {
    client: {
      get: jest.fn(),
    },
  },
}));

describe("DeploymentAnalysisService", () => {
  let service: DeploymentAnalysisService;

  beforeEach(() => {
    service = new DeploymentAnalysisService();
    jest.clearAllMocks();
  });

  describe("getRecentDeploymentContext", () => {
    it("should return deployment context with merged PRs", async () => {
      const { githubService } = require("../githubService");
      (githubService.client.get as jest.Mock).mockResolvedValueOnce({
        data: [
          {
            number: 123,
            title: "Fix login bug",
            user: { login: "developer1" },
            merged_at: "2024-01-15T10:00:00Z",
            merge_commit_sha: "abc123",
          },
          {
            number: 124,
            title: "Add new feature",
            user: { login: "developer2" },
            merged_at: "2024-01-14T10:00:00Z",
            merge_commit_sha: "def456",
          },
        ],
      });

      const result = await service.getRecentDeploymentContext(
        123,
        "owner",
        "repo",
        "2024-01-16T00:00:00Z"
      );

      expect(result).toContain("PR #123");
      expect(result).toContain("Fix login bug");
      expect(result).toContain("PR #124");
      expect(result).toContain("Add new feature");
    });

    it("should return message when no PRs found", async () => {
      const { githubService } = require("../githubService");
      (githubService.client.get as jest.Mock).mockResolvedValueOnce({
        data: [],
      });

      const result = await service.getRecentDeploymentContext(
        123,
        "owner",
        "repo",
        "2024-01-16T00:00:00Z"
      );

      expect(result).toBe("No recently merged PRs found before the incident.");
    });

    it("should handle errors gracefully", async () => {
      const { githubService } = require("../githubService");
      (githubService.client.get as jest.Mock).mockRejectedValueOnce(
        new Error("API Error")
      );

      const result = await service.getRecentDeploymentContext(
        123,
        "owner",
        "repo",
        "2024-01-16T00:00:00Z"
      );

      expect(result).toBe(
        "Unable to retrieve recent deployment context due to an error."
      );
    });

    it("should only include PRs merged before incident timestamp", async () => {
      const { githubService } = require("../githubService");
      (githubService.client.get as jest.Mock).mockResolvedValueOnce({
        data: [
          {
            number: 125,
            title: "Future PR",
            user: { login: "developer" },
            merged_at: "2024-01-20T10:00:00Z",
            merge_commit_sha: "xyz789",
          },
          {
            number: 123,
            title: "Past PR",
            user: { login: "developer" },
            merged_at: "2024-01-15T10:00:00Z",
            merge_commit_sha: "abc123",
          },
        ],
      });

      const result = await service.getRecentDeploymentContext(
        123,
        "owner",
        "repo",
        "2024-01-16T00:00:00Z"
      );

      expect(result).toContain("PR #123");
      expect(result).toContain("Past PR");
      expect(result).not.toContain("Future PR");
    });

    it("should limit context to 5 most recent PRs", async () => {
      const { githubService } = require("../githubService");
      const mockData = Array.from({ length: 10 }, (_, i) => ({
        number: i + 1,
        title: `PR ${i + 1}`,
        user: { login: "developer" },
        merged_at: new Date(Date.now() - i * 86400000).toISOString(),
        merge_commit_sha: `sha${i}`,
      }));

      (githubService.client.get as jest.Mock).mockResolvedValueOnce({
        data: mockData,
      });

      const result = await service.getRecentDeploymentContext(
        123,
        "owner",
        "repo",
        new Date(Date.now() + 86400000).toISOString()
      );

      const prCount = (result.match(/PR #/g) || []).length;
      expect(prCount).toBeLessThanOrEqual(5);
    });
  });
});
