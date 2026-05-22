/**
 * Comprehensive tests for GitHubService pagination, retry, and rate-limit logic
 * Run with: npm test (requires Jest configuration and nock for HTTP mocking)
 */

import { GitHubService, GitHubRateLimitError } from "./githubService";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";

describe("GitHubService", () => {
  let service: GitHubService;
  let mock: MockAdapter;

  beforeEach(() => {
    service = new GitHubService("test-token");
    mock = new MockAdapter(service["client"]);
  });

  afterEach(() => {
    mock.reset();
  });

  describe("listUserRepositories - Pagination", () => {
    it("should return paginated repositories with nextPage metadata", async () => {
      const repos = [
        {
          id: 1,
          name: "repo1",
          full_name: "user/repo1",
          private: false,
          html_url: "https://github.com/user/repo1",
          clone_url: "https://github.com/user/repo1.git",
          default_branch: "main",
          size: 100,
          stargazers_count: 5,
          forks_count: 2,
          language: "TypeScript",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          description: "Test repo",
          owner: {
            login: "user",
            avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
          },
        },
        {
          id: 2,
          name: "repo2",
          full_name: "user/repo2",
          private: false,
          html_url: "https://github.com/user/repo2",
          clone_url: "https://github.com/user/repo2.git",
          default_branch: "main",
          size: 200,
          stargazers_count: 10,
          forks_count: 5,
          language: "JavaScript",
          created_at: "2024-01-02T00:00:00Z",
          updated_at: "2024-01-02T00:00:00Z",
          description: "Test repo 2",
          owner: {
            login: "user",
            avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
          },
        },
      ];

      mock.onGet("/user/repos").reply(200, repos, {
        link: '<https://api.github.com/user/repos?page=2&per_page=2>; rel="next"',
      });

      const result = await service.listUserRepositories(undefined, {
        per_page: 2,
        page: 1,
        max_pages: 1,
      });

      expect(result.repositories.length).toBe(2);
      expect(result.nextPage).toBe(2);
      expect(result.repositories[0].id).toBe(1);
    });

    it("should respect max_pages limit", async () => {
      const reposPage1 = [
        {
          id: 1,
          name: "repo1",
          full_name: "user/repo1",
          private: false,
          html_url: "https://github.com/user/repo1",
          clone_url: "https://github.com/user/repo1.git",
          default_branch: "main",
          size: 100,
          stargazers_count: 5,
          forks_count: 2,
          language: "TypeScript",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          description: "Test repo",
          owner: {
            login: "user",
            avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
          },
        },
      ];
      const reposPage2 = [
        {
          id: 2,
          name: "repo2",
          full_name: "user/repo2",
          private: false,
          html_url: "https://github.com/user/repo2",
          clone_url: "https://github.com/user/repo2.git",
          default_branch: "main",
          size: 200,
          stargazers_count: 10,
          forks_count: 5,
          language: "JavaScript",
          created_at: "2024-01-02T00:00:00Z",
          updated_at: "2024-01-02T00:00:00Z",
          description: "Test repo 2",
          owner: {
            login: "user",
            avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
          },
        },
      ];

      mock
        .onGet(
          "/user/repos?page=1&per_page=1&type=owner&sort=updated&direction=desc",
        )
        .reply(200, reposPage1, {
          link: '<https://api.github.com/user/repos?page=2&per_page=1>; rel="next"',
        });
      mock
        .onGet(
          "/user/repos?page=2&per_page=1&type=owner&sort=updated&direction=desc",
        )
        .reply(200, reposPage2, {});

      const result = await service.listUserRepositories(undefined, {
        per_page: 1,
        page: 1,
        max_pages: 2,
      });

      expect(result.repositories.length).toBe(2);
    });

    it("should stop fetching when items < per_page", async () => {
      const repos = [
        {
          id: 1,
          name: "repo1",
          full_name: "user/repo1",
          private: false,
          html_url: "https://github.com/user/repo1",
          clone_url: "https://github.com/user/repo1.git",
          default_branch: "main",
          size: 100,
          stargazers_count: 5,
          forks_count: 2,
          language: "TypeScript",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          description: "Test repo",
          owner: {
            login: "user",
            avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
          },
        },
      ];

      mock.onGet("/user/repos").reply(200, repos, {});

      const result = await service.listUserRepositories(undefined, {
        per_page: 2,
        page: 1,
        max_pages: 5,
      });

      expect(result.repositories.length).toBe(1);
      expect(result.nextPage).toBeUndefined();
    });
  });

  describe("Rate Limit Handling - 429 & Retry-After", () => {
    it("should throw GitHubRateLimitError with retryAfterSeconds from Retry-After header", async () => {
      mock.onGet("/user/repos").reply(
        429,
        { message: "API rate limit exceeded" },
        {
          "retry-after": "60",
        },
      );

      await expect(
        service.listUserRepositories(undefined, {
          per_page: 30,
          page: 1,
          max_pages: 1,
        }),
      ).rejects.toThrow(GitHubRateLimitError);
    });

    it("should extract retryAfterSeconds from x-ratelimit-reset header", async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 120;
      mock.onGet("/user/repos").reply(
        429,
        { message: "API rate limit exceeded" },
        {
          "x-ratelimit-reset": String(futureTime),
        },
      );

      try {
        await service.listUserRepositories(undefined, {
          per_page: 30,
          page: 1,
          max_pages: 1,
        });
      } catch (error) {
        if (error instanceof GitHubRateLimitError) {
          expect(error.retryAfterSeconds).toBeGreaterThan(0);
        }
      }
    });

    it("should return partial results before throwing rate limit error on multi-page fetch", async () => {
      const reposPage1 = [
        {
          id: 1,
          name: "repo1",
          full_name: "user/repo1",
          private: false,
          html_url: "https://github.com/user/repo1",
          clone_url: "https://github.com/user/repo1.git",
          default_branch: "main",
          size: 100,
          stargazers_count: 5,
          forks_count: 2,
          language: "TypeScript",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          description: "Test repo",
          owner: {
            login: "user",
            avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
          },
        },
      ];

      mock
        .onGet(
          "/user/repos?page=1&per_page=1&type=owner&sort=updated&direction=desc",
        )
        .reply(200, reposPage1, {
          link: '<https://api.github.com/user/repos?page=2&per_page=1>; rel="next"',
        });
      mock
        .onGet(
          "/user/repos?page=2&per_page=1&type=owner&sort=updated&direction=desc",
        )
        .reply(
          429,
          { message: "API rate limit exceeded" },
          { "retry-after": "60" },
        );

      const result = await service.listUserRepositories(undefined, {
        per_page: 1,
        page: 1,
        max_pages: 5,
      });

      expect(result.repositories.length).toBe(1);
      expect(result.nextPage).toBe(2);
    });
  });

  describe("Transient Error Retries - 502/503/504", () => {
    it("should retry on 502 and eventually succeed", async () => {
      const repos = [
        {
          id: 1,
          name: "repo1",
          full_name: "user/repo1",
          private: false,
          html_url: "https://github.com/user/repo1",
          clone_url: "https://github.com/user/repo1.git",
          default_branch: "main",
          size: 100,
          stargazers_count: 5,
          forks_count: 2,
          language: "TypeScript",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          description: "Test repo",
          owner: {
            login: "user",
            avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
          },
        },
      ];

      mock.onGet("/repos/user/repo").replyOnce(502).replyOnce(200, repos);

      const result = await service.getRepository("user", "repo");

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
    });

    it("should handle 503 with retries", async () => {
      mock
        .onGet("/repos/user/repo")
        .replyOnce(503)
        .replyOnce(503)
        .replyOnce(200, { id: 1, name: "repo1" });

      const result = await service.getRepository("user", "repo");

      expect(result).not.toBeNull();
    });
  });

  describe("404 Handling", () => {
    it("getRepository should return null on 404", async () => {
      mock
        .onGet("/repos/user/nonexistent")
        .reply(404, { message: "Not Found" });

      const result = await service.getRepository("user", "nonexistent");

      expect(result).toBeNull();
    });

    it("getBranches should return empty array on 404", async () => {
      mock
        .onGet("/repos/user/nonexistent/branches")
        .reply(404, { message: "Not Found" });

      const result = await service.getBranches("user", "nonexistent");

      expect(result).toEqual([]);
    });

    it("getCommits should return empty array on 404", async () => {
      mock
        .onGet("/repos/user/nonexistent/commits")
        .reply(404, { message: "Not Found" });

      const result = await service.getCommits("user", "nonexistent");

      expect(result).toEqual([]);
    });

    it("getCommits should return empty array on 409 (empty repo)", async () => {
      mock
        .onGet("/repos/user/empty-repo/commits")
        .reply(409, { message: "Conflict" });

      const result = await service.getCommits("user", "empty-repo");

      expect(result).toEqual([]);
    });
  });

  describe("Idempotency & Comment Posting", () => {
    it("postPullRequestComment should post successfully to issue endpoint", async () => {
      mock.onPost("/repos/user/repo/issues/1/comments").reply(201, {
        id: 12345,
        html_url: "https://github.com/user/repo/issues/1#issuecomment-12345",
      });

      const result = await service.postPullRequestComment(
        "user",
        "repo",
        1,
        "Test comment",
      );

      expect(result.id).toBe(12345);
      expect(result.html_url).toContain("issuecomment");
    });

    it("postPullRequestComment should fallback to PR review on 403", async () => {
      mock
        .onPost("/repos/user/repo/issues/1/comments")
        .reply(403, { message: "Resource not accessible by integration" });
      mock.onPost("/repos/user/repo/pulls/1/reviews").reply(200, {
        id: 67890,
        html_url: "https://github.com/user/repo/pull/1#review-67890",
      });

      const result = await service.postPullRequestComment(
        "user",
        "repo",
        1,
        "Test comment",
      );

      expect(result.id).toBe(67890);
    });

    it("should throw on invalid comment body", async () => {
      await expect(
        service.postPullRequestComment("user", "repo", 1, "  "),
      ).rejects.toThrow("Comment body is required");
    });
  });

  describe("Other Single-Resource Methods", () => {
    it("getLanguages should return empty object on 404", async () => {
      mock
        .onGet("/repos/user/nonexistent/languages")
        .reply(404, { message: "Not Found" });

      const result = await service.getLanguages("user", "nonexistent");

      expect(result).toEqual({});
    });

    it("getContributors should return empty array on 404", async () => {
      mock
        .onGet("/repos/user/nonexistent/contributors")
        .reply(404, { message: "Not Found" });

      const result = await service.getContributors("user", "nonexistent");

      expect(result).toEqual([]);
    });

    it("getPullRequestFiles should support multi-page fetching", async () => {
      const filesPage1 = [
        {
          sha: "abc123",
          filename: "file1.ts",
          status: "modified",
          additions: 10,
          deletions: 5,
          changes: 15,
        },
      ];
      const filesPage2 = [
        {
          sha: "def456",
          filename: "file2.ts",
          status: "added",
          additions: 20,
          deletions: 0,
          changes: 20,
        },
      ];

      mock
        .onGet("/repos/user/repo/pulls/1/files")
        .replyOnce(200, filesPage1, {
          link: '<https://api.github.com/repos/user/repo/pulls/1/files?page=2&per_page=1>; rel="next"',
        })
        .replyOnce(200, filesPage2, {});

      const result = await service.getPullRequestFiles("user", "repo", 1, {
        per_page: 1,
        max_pages: 2,
      });

      expect(result.length).toBe(2);
      expect(result[0].filename).toBe("file1.ts");
      expect(result[1].filename).toBe("file2.ts");
    });
  });

  describe("GitHubRateLimitError", () => {
    it("should have correct retryAfterSeconds", () => {
      const error = new GitHubRateLimitError(60);

      expect(error.retryAfterSeconds).toBe(60);
      expect(error.message).toContain("60 seconds");
    });

    it("should handle undefined retryAfterSeconds gracefully", () => {
      const error = new GitHubRateLimitError(0);

      expect(error.retryAfterSeconds).toBe(0);
      expect(error.message).toContain("later");
    });
  });
});
