"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.githubService = exports.GitHubService = exports.GitHubRateLimitError = void 0;
exports.sanitizeGitHubError = sanitizeGitHubError;
const axios_1 = __importStar(require("axios"));
class GitHubRateLimitError extends Error {
    retryAfterSeconds;
    constructor(retryAfterSeconds) {
        super(`GitHub API rate limit reached. Please retry after ${retryAfterSeconds} seconds.`);
        this.name = "GitHubRateLimitError";
        this.retryAfterSeconds = retryAfterSeconds;
    }
}
exports.GitHubRateLimitError = GitHubRateLimitError;
function sanitizeGitHubHeaders(headers) {
    if (headers == null) {
        return headers;
    }
    if (Array.isArray(headers)) {
        return headers.map((value) => sanitizeGitHubHeaders(value));
    }
    if (typeof headers !== "object") {
        return headers;
    }
    const source = typeof headers.toJSON === "function" ? headers.toJSON() : headers;
    if (source == null || typeof source !== "object") {
        return source;
    }
    const sanitized = Array.isArray(source) ? [] : {};
    for (const [key, value] of Object.entries(source)) {
        if (key.toLowerCase() === "authorization") {
            sanitized[key] = "[REDACTED]";
        }
        else if (value != null && typeof value === "object") {
            sanitized[key] = sanitizeGitHubHeaders(value);
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}
function sanitizeGitHubError(error) {
    if ((0, axios_1.isAxiosError)(error) && error.config) {
        const safeConfig = {
            ...error.config,
            headers: sanitizeGitHubHeaders(error.config.headers),
        };
        error.config = safeConfig;
    }
    return error;
}
class GitHubService {
    client;
    token;
    constructor(token) {
        this.token = token;
        this.client = axios_1.default.create({
            baseURL: "https://api.github.com",
            headers: {
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "GitVerse-App",
                ...(token && { Authorization: `Bearer ${token}` }),
            },
        });
        this.client.interceptors.response.use((response) => response, async (error) => {
            if (!(0, axios_1.isAxiosError)(error) || !error.config) {
                throw sanitizeGitHubError(error);
            }
            const status = error.response?.status;
            const config = error.config;
            if (status === 429 || status === 403) {
                const rateLimitRemaining = error.response?.headers?.["x-ratelimit-remaining"];
                if (status === 429 || rateLimitRemaining === "0") {
                    const retryAfterHeader = error.response?.headers?.["retry-after"];
                    const resetHeader = error.response?.headers?.["x-ratelimit-reset"];
                    let retrySeconds = 60;
                    if (retryAfterHeader) {
                        retrySeconds = parseInt(retryAfterHeader, 10);
                    }
                    else if (resetHeader) {
                        const resetTime = parseInt(resetHeader, 10) * 1000;
                        retrySeconds = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000));
                    }
                    throw new GitHubRateLimitError(retrySeconds);
                }
            }
            const retryStatusCodes = [502, 503, 504];
            if ((status && retryStatusCodes.includes(status)) ||
                error.code === "ECONNABORTED" ||
                !error.response) {
                config.retryCount = config.retryCount || 0;
                if (config.retryCount < 3) {
                    config.retryCount += 1;
                    const backoff = Math.pow(2, config.retryCount) * 1000 + Math.random() * 1000;
                    await new Promise((resolve) => setTimeout(resolve, backoff));
                    return this.client(config);
                }
            }
            throw sanitizeGitHubError(error);
        });
    }
    /**
     * Get authenticated user information
     */
    async getAuthenticatedUser() {
        if (!this.token) {
            throw new Error("GitHub token required for authentication");
        }
        const response = await this.client.get("/user");
        return response.data;
    }
    /**
     * Get repository information
     */
    async getRepository(owner, repo) {
        const response = await this.client.get(`/repos/${owner}/${repo}`);
        return response.data;
    }
    /**
     * List user repositories
     */
    async listUserRepositories(username, params) {
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
    async listInstallationRepositories(params) {
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
    async getBranches(owner, repo) {
        const response = await this.client.get(`/repos/${owner}/${repo}/branches`);
        return response.data;
    }
    /**
     * Get repository commits
     */
    async getCommits(owner, repo, params) {
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
    async getCommit(owner, repo, sha) {
        const response = await this.client.get(`/repos/${owner}/${repo}/commits/${sha}`);
        return response.data;
    }
    /**
     * Get pull request metadata
     */
    async getPullRequest(owner, repo, pullNumber) {
        const response = await this.client.get(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
        return response.data;
    }
    /**
     * List pull request files (includes patch hunks when available)
     */
    async getPullRequestFiles(owner, repo, pullNumber, params) {
        const perPage = Math.min(Math.max(params?.per_page ?? 100, 1), 100);
        const maxPages = Math.min(Math.max(params?.max_pages ?? 10, 1), 50);
        const all = [];
        for (let page = 1; page <= maxPages; page++) {
            const response = await this.client.get(`/repos/${owner}/${repo}/pulls/${pullNumber}/files`, {
                params: {
                    per_page: perPage,
                    page,
                },
            });
            const items = response.data;
            if (!Array.isArray(items) || items.length === 0)
                break;
            all.push(...items);
            if (items.length < perPage)
                break;
        }
        return all;
    }
    /**
     * Post a comment on a pull request (PR comments are issue comments in GitHub API)
     */
    async postPullRequestComment(owner, repo, pullNumber, body) {
        if (!body?.trim()) {
            throw new Error("Comment body is required");
        }
        // Preferred: issue comment (PRs are issues in GitHub).
        try {
            const response = await this.client.post(`/repos/${owner}/${repo}/issues/${pullNumber}/comments`, { body });
            return response.data;
        }
        catch (err) {
            // Common GitHub App failure: issues are disabled, or the integration cannot access issue comments.
            const axiosErr = (0, axios_1.isAxiosError)(err)
                ? err
                : null;
            const status = axiosErr?.response?.status;
            const message = String(axiosErr?.response?.data?.message || "");
            if (status !== 403)
                throw err;
            if (message.toLowerCase().includes("resource not accessible") ||
                message.toLowerCase().includes("integration") ||
                message.toLowerCase().includes("issues")) {
                // Fallback: create a PR review (shows up in PR conversation as a review comment).
                const response = await this.client.post(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, {
                    body,
                    event: "COMMENT",
                });
                // Shape to match the issue-comment return type.
                return {
                    id: Number(response.data?.id || 0),
                    html_url: String(response.data?.html_url || ""),
                };
            }
            throw err;
        }
    }
    /**
     * Get repository languages
     */
    async getLanguages(owner, repo) {
        const response = await this.client.get(`/repos/${owner}/${repo}/languages`);
        return response.data;
    }
    /**
     * Get repository contributors
     */
    async getContributors(owner, repo) {
        const response = await this.client.get(`/repos/${owner}/${repo}/contributors`);
        return response.data;
    }
    /**
     * Search repositories
     */
    async searchRepositories(query, params) {
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
    static parseGitHubUrl(url) {
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
     * Validate GitHub token
     */
    async validateToken() {
        try {
            await this.getAuthenticatedUser();
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.GitHubService = GitHubService;
exports.githubService = new GitHubService();
