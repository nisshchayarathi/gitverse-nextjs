import axios, { AxiosError, AxiosInstance, isAxiosError } from "axios";

export class GitHubRateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super(`GitHub API rate limit reached. Please retry after ${retryAfterSeconds} seconds.`);
    this.name = "GitHubRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function sanitizeGitHubHeaders(headers: any): any {
  if (headers == null) {
    return headers;
  }

  if (Array.isArray(headers)) {
    return headers.map((value) => sanitizeGitHubHeaders(value));
  }

  if (typeof headers !== "object") {
    return headers;
  }

  const source =
    typeof (headers as any).toJSON === "function" ? (headers as any).toJSON() : headers;

  if (source == null || typeof source !== "object") {
    return source;
  }

  const sanitized: Record<string, any> = Array.isArray(source) ? [] : {};

  for (const [key, value] of Object.entries(source)) {
    if (key.toLowerCase() === "authorization") {
      sanitized[key] = "[REDACTED]";
    } else if (value != null && typeof value === "object") {
      sanitized[key] = sanitizeGitHubHeaders(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export function sanitizeGitHubError(error: any) {
  if (isAxiosError(error) && error.config) {
    const safeConfig = {
      ...error.config,
      headers: sanitizeGitHubHeaders(error.config.headers),
    };
    error.config = safeConfig as any;
  }
  return error;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
  size: number;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  created_at: string;
  updated_at: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubUser {
  login: string;
  id: number;
  name: string;
  email: string | null;
  avatar_url: string;
  public_repos: number;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  stats?: {
    total: number;
    additions: number;
    deletions: number;
  };
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  html_url: string;
  user: {
    login: string;
    avatar_url: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  head: {
    ref: string;
    sha: string;
  };
}

export interface GitHubPullRequestFile {
  sha: string;
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export class GitHubService {
  private client: AxiosInstance;
  private token?: string;

  constructor(token?: string) {
    this.token = token;
    this.client = axios.create({
      baseURL: "https://api.github.com",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "GitVerse-App",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (!isAxiosError(error) || !error.config) {
          throw sanitizeGitHubError(error);
        }

        const status = error.response?.status;
        const config = error.config as any;

        if (status === 429 || status === 403) {
          const rateLimitRemaining = error.response?.headers?.["x-ratelimit-remaining"];
          if (status === 429 || rateLimitRemaining === "0") {
            const retryAfterHeader = error.response?.headers?.["retry-after"];
            const resetHeader = error.response?.headers?.["x-ratelimit-reset"];
            let retrySeconds = 60;

            if (retryAfterHeader) {
              retrySeconds = parseInt(retryAfterHeader, 10);
            } else if (resetHeader) {
              const resetTime = parseInt(resetHeader, 10) * 1000;
              retrySeconds = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000));
            }
            throw new GitHubRateLimitError(retrySeconds);
          }
        }

        const retryStatusCodes = [502, 503, 504];
        if (
          (status && retryStatusCodes.includes(status)) ||
          error.code === "ECONNABORTED" ||
          !error.response
        ) {
          config.retryCount = config.retryCount || 0;
          if (config.retryCount < 3) {
            config.retryCount += 1;
            const backoff = Math.pow(2, config.retryCount) * 1000 + Math.random() * 1000;
            await new Promise((resolve) => setTimeout(resolve, backoff));
            return this.client(config);
          }
        }

        throw sanitizeGitHubError(error);
      }
    );
  }

  /**
   * Get authenticated user information
   */
  async getAuthenticatedUser(): Promise<GitHubUser> {
    if (!this.token) {
      throw new Error("GitHub token required for authentication");
    }

    const response = await this.client.get("/user");
    return response.data;
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    const response = await this.client.get(`/repos/${owner}/${repo}`);
    return response.data;
  }

  /**
   * List user repositories
   */
  async listUserRepositories(
    username?: string,
    params?: {
      type?: "all" | "owner" | "member";
      sort?: "created" | "updated" | "pushed" | "full_name";
      direction?: "asc" | "desc";
      per_page?: number;
      page?: number;
    },
  ): Promise<GitHubRepository[]> {
    const endpoint = username ? `/users/${username}/repos` : "/user/repos";

    const response = await this.client.get(endpoint, {
      params: {
        type: params?.type || "owner",
        sort: params?.sort || "updated",
        direction: params?.direction || "desc",
        per_page: params?.per_page || 30,
        page: params?.page || 1,
      },
    });

    return response.data;
  }

  /**
   * List repositories accessible to the current GitHub App installation token.
   * Requires an installation access token (NOT a user token).
   */
  async listInstallationRepositories(params?: {
    per_page?: number;
    page?: number;
  }): Promise<{ total_count: number; repositories: GitHubRepository[] }> {
    const perPage = Math.min(Math.max(params?.per_page ?? 100, 1), 100);
    const page = Math.max(params?.page ?? 1, 1);

    const response = await this.client.get("/installation/repositories", {
      params: { per_page: perPage, page },
    });

    return {
      total_count: Number(response.data?.total_count || 0),
      repositories: Array.isArray(response.data?.repositories)
        ? response.data.repositories
        : [],
    };
  }

  /**
   * Get repository branches
   */
  async getBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    const response = await this.client.get(`/repos/${owner}/${repo}/branches`);
    return response.data;
  }

  /**
   * Get repository commits
   */
  async getCommits(
    owner: string,
    repo: string,
    params?: {
      sha?: string;
      path?: string;
      per_page?: number;
      page?: number;
    },
  ): Promise<GitHubCommit[]> {
    const response = await this.client.get(`/repos/${owner}/${repo}/commits`, {
      params: {
        sha: params?.sha,
        path: params?.path,
        per_page: params?.per_page || 100,
        page: params?.page || 1,
      },
    });

    return response.data;
  }

  /**
   * Get commit details with stats
   */
  async getCommit(
    owner: string,
    repo: string,
    sha: string,
  ): Promise<GitHubCommit> {
    const response = await this.client.get(
      `/repos/${owner}/${repo}/commits/${sha}`,
    );
    return response.data;
  }

  /**
   * Get pull request metadata
   */
  async getPullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<GitHubPullRequest> {
    const response = await this.client.get(
      `/repos/${owner}/${repo}/pulls/${pullNumber}`,
    );
    return response.data;
  }

  /**
   * List pull request files (includes patch hunks when available)
   */
  async getPullRequestFiles(
    owner: string,
    repo: string,
    pullNumber: number,
    params?: { per_page?: number; max_pages?: number },
  ): Promise<GitHubPullRequestFile[]> {
    const perPage = Math.min(Math.max(params?.per_page ?? 100, 1), 100);
    const maxPages = Math.min(Math.max(params?.max_pages ?? 5, 1), 50);
    const maxTotalPatchChars = 2_000_000; // Limit total patch data loaded in memory to ~2MB

    const all: GitHubPullRequestFile[] = [];
    let currentPatchChars = 0;

    for (let page = 1; page <= maxPages; page++) {
      const response = await this.client.get(
        `/repos/${owner}/${repo}/pulls/${pullNumber}/files`,
        {
          params: {
            per_page: perPage,
            page,
          },
        },
      );

      const items: GitHubPullRequestFile[] = response.data;
      if (!Array.isArray(items) || items.length === 0) break;
      
      for (const item of items) {
        all.push(item);
        if (item.patch) {
          currentPatchChars += item.patch.length;
        }
      }

      if (items.length < perPage) break;
      if (currentPatchChars >= maxTotalPatchChars) {
        console.warn(`[getPullRequestFiles] Halting pagination early: patch size limit exceeded (${currentPatchChars} chars)`);
        break;
      }
    }

    return all;
  }

  /**
   * Post a comment on a pull request (PR comments are issue comments in GitHub API)
   */
  async postPullRequestComment(
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
  ): Promise<{ id: number; html_url: string }> {
    if (!body?.trim()) {
      throw new Error("Comment body is required");
    }

    // Preferred: issue comment (PRs are issues in GitHub).
    try {
      const response = await this.client.post(
        `/repos/${owner}/${repo}/issues/${pullNumber}/comments`,
        { body },
      );
      return response.data;
    } catch (err: unknown) {
      // Common GitHub App failure: issues are disabled, or the integration cannot access issue comments.
      const axiosErr = isAxiosError(err)
        ? (err as AxiosError<{ message?: string }>)
        : null;
      const status = axiosErr?.response?.status;
      const message = String(axiosErr?.response?.data?.message || "");

      if (status !== 403) throw err;

      if (
        message.toLowerCase().includes("resource not accessible") ||
        message.toLowerCase().includes("integration") ||
        message.toLowerCase().includes("issues")
      ) {
        // Fallback: create a PR review (shows up in PR conversation as a review comment).
        const response = await this.client.post(
          `/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`,
          {
            body,
            event: "COMMENT",
          },
        );

        // Shape to match the issue-comment return type.
        return {
          id: Number((response.data as any)?.id || 0),
          html_url: String((response.data as any)?.html_url || ""),
        };
      }

      throw err;
    }
  }

  /**
   * Post a comment on an issue
   */
  async postIssueComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string,
  ): Promise<{ id: number; html_url: string }> {
    if (!body?.trim()) {
      throw new Error("Comment body is required");
    }

    const response = await this.client.post(
      `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      { body },
    );
    return response.data;
  }

  /**
   * Get repository labels
   */
  async getRepoLabels(owner: string, repo: string): Promise<Array<{ name: string }>> {
    const response = await this.client.get(`/repos/${owner}/${repo}/labels`);
    return response.data;
  }

  /**
   * Add labels to an issue
   */
  async addIssueLabels(
    owner: string,
    repo: string,
    issueNumber: number,
    labels: string[],
  ): Promise<void> {
    if (!labels || labels.length === 0) return;
    await this.client.post(
      `/repos/${owner}/${repo}/issues/${issueNumber}/labels`,
      { labels },
    );
  }

  /**
   * Get repository languages
   */
  async getLanguages(
    owner: string,
    repo: string,
  ): Promise<Record<string, number>> {
    const response = await this.client.get(`/repos/${owner}/${repo}/languages`);
    return response.data;
  }

  /**
   * Get repository contributors
   */
  async getContributors(
    owner: string,
    repo: string,
  ): Promise<
    Array<{
      login: string;
      contributions: number;
      avatar_url: string;
    }>
  > {
    const response = await this.client.get(
      `/repos/${owner}/${repo}/contributors`,
    );
    return response.data;
  }

  /**
   * Fetch file content from repository
   */
  async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string | null> {
    try {
      const url = ref ? `/repos/${owner}/${repo}/contents/${path}?ref=${ref}` : `/repos/${owner}/${repo}/contents/${path}`;
      const response = await this.client.get(url);
      if (response.data && response.data.content) {
        return Buffer.from(response.data.content, "base64").toString("utf-8");
      }
      return null;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(owner: string, repo: string, branch: string, sha: string): Promise<any> {
    const response = await this.client.post(`/repos/${owner}/${repo}/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha,
    });
    return response.data;
  }

  /**
   * Create a new commit with a single file change
   */
  async createCommit(
    owner: string, 
    repo: string, 
    path: string, 
    message: string, 
    content: string, 
    branch: string,
    sha: string
  ): Promise<any> {
    // 1. Get current file (to get its blob SHA)
    let fileSha: string | undefined;
    try {
      const fileRes = await this.client.get(`/repos/${owner}/${repo}/contents/${path}?ref=${branch}`);
      fileSha = fileRes.data.sha;
    } catch (e: any) {
      // If file doesn't exist yet, fileSha is undefined
    }

    // 2. Update file
    const response = await this.client.put(`/repos/${owner}/${repo}/contents/${path}`, {
      message,
      content: Buffer.from(content).toString("base64"),
      branch,
      sha: fileSha
    });
    
    return response.data;
  }

  /**
   * Create a Pull Request
   */
  async createPullRequest(
    owner: string, 
    repo: string, 
    title: string, 
    body: string, 
    head: string, 
    base: string
  ): Promise<any> {
    const response = await this.client.post(`/repos/${owner}/${repo}/pulls`, {
      title,
      body,
      head,
      base,
    });
    return response.data;
  }

  /**
   * Search repositories
   */
  async searchRepositories(
    query: string,
    params?: {
      sort?: "stars" | "forks" | "updated";
      order?: "asc" | "desc";
      per_page?: number;
      page?: number;
    },
  ): Promise<{ items: GitHubRepository[]; total_count: number }> {
    const response = await this.client.get("/search/repositories", {
      params: {
        q: query,
        sort: params?.sort,
        order: params?.order || "desc",
        per_page: params?.per_page || 30,
        page: params?.page || 1,
      },
    });

    return response.data;
  }

  /**
   * Parse GitHub URL to extract owner and repo
   */
  static parseGitHubUrl(url: string): { owner: string; repo: string } | null {
    const patterns = [
      /github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/,
      /github\.com\/([^\/]+)\/([^\/]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace(/\.git$/, ""),
        };
      }
    }

    return null;
  }

  /**
   * Create a review comment on a Pull Request (useful for Suggested Changes)
   */
  async createPullRequestReviewComment(
    owner: string,
    repo: string,
    pullNumber: number,
    commitId: string,
    path: string,
    body: string,
    line: number,
    startLine?: number
  ): Promise<any> {
    const payload: any = {
      body,
      commit_id: commitId,
      path,
      line,
    };
    if (startLine && startLine < line) {
      payload.start_line = startLine;
      payload.start_side = "RIGHT";
    }

    const response = await this.client.post(
      `/repos/${owner}/${repo}/pulls/${pullNumber}/comments`,
      payload
    );
    return response.data;
  }

  /**
   * Validate GitHub token
   */
  async validateToken(): Promise<boolean> {
    try {
      await this.getAuthenticatedUser();
      return true;
    } catch {
      return false;
    }
  }
}

export const githubService = new GitHubService();
