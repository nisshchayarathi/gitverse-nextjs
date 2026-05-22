"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gitlabService = exports.GitLabService = void 0;
const axios_1 = __importDefault(require("axios"));
class GitLabService {
    client;
    token;
    constructor(token, baseURL = 'https://gitlab.com/api/v4') {
        this.token = token;
        this.client = axios_1.default.create({
            baseURL,
            headers: {
                ...(token && { 'PRIVATE-TOKEN': token }),
            },
        });
    }
    /**
     * Get authenticated user
     */
    async getAuthenticatedUser() {
        if (!this.token) {
            throw new Error('GitLab token required for authentication');
        }
        const response = await this.client.get('/user');
        return response.data;
    }
    /**
     * Get project by ID
     */
    async getProject(projectId) {
        const response = await this.client.get(`/projects/${encodeURIComponent(projectId)}`);
        return response.data;
    }
    /**
     * List user projects
     */
    async listUserProjects(params) {
        const response = await this.client.get('/projects', {
            params: {
                owned: params?.owned ?? true,
                membership: params?.membership ?? true,
                per_page: params?.per_page || 20,
                page: params?.page || 1,
            },
        });
        return response.data;
    }
    /**
     * Get project branches
     */
    async getBranches(projectId) {
        const response = await this.client.get(`/projects/${encodeURIComponent(projectId)}/repository/branches`);
        return response.data;
    }
    /**
     * Get project commits
     */
    async getCommits(projectId, params) {
        const response = await this.client.get(`/projects/${encodeURIComponent(projectId)}/repository/commits`, {
            params: {
                ref_name: params?.ref_name,
                per_page: params?.per_page || 100,
                page: params?.page || 1,
            },
        });
        return response.data;
    }
    /**
     * Get project contributors
     */
    async getContributors(projectId) {
        const response = await this.client.get(`/projects/${encodeURIComponent(projectId)}/repository/contributors`);
        return response.data;
    }
    /**
     * Parse GitLab URL
     */
    static parseGitLabUrl(url) {
        const patterns = [/gitlab\.com\/([^\/]+\/[^\/]+?)(?:\.git)?$/, /gitlab\.com\/([^\/]+\/[^\/]+)/];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return { projectPath: match[1].replace(/\.git$/, '') };
            }
        }
        return null;
    }
    /**
     * Validate token
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
exports.GitLabService = GitLabService;
exports.gitlabService = new GitLabService();
