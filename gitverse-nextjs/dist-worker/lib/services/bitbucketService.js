"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bitbucketService = exports.BitbucketService = void 0;
const axios_1 = __importDefault(require("axios"));
class BitbucketService {
    client;
    token;
    constructor(token) {
        this.token = token;
        this.client = axios_1.default.create({
            baseURL: 'https://api.bitbucket.org/2.0',
            headers: {
                Accept: 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
            },
        });
    }
    /**
     * Get authenticated user
     */
    async getAuthenticatedUser() {
        if (!this.token) {
            throw new Error('Bitbucket token required for authentication');
        }
        const response = await this.client.get('/user');
        return response.data;
    }
    /**
     * Get repository
     */
    async getRepository(workspace, repoSlug) {
        const response = await this.client.get(`/repositories/${workspace}/${repoSlug}`);
        return response.data;
    }
    /**
     * List user repositories
     */
    async listUserRepositories(params) {
        const response = await this.client.get('/repositories', {
            params: {
                pagelen: params?.per_page || 20,
                page: params?.page || 1,
            },
        });
        return response.data;
    }
    /**
     * Parse Bitbucket URL
     */
    static parseBitbucketUrl(url) {
        const patterns = [
            /bitbucket\.org\/([^\/]+)\/([^\/]+?)(?:\.git)?$/,
            /bitbucket\.org\/([^\/]+)\/([^\/]+)/,
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return {
                    workspace: match[1],
                    repoSlug: match[2].replace(/\.git$/, ''),
                };
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
exports.BitbucketService = BitbucketService;
exports.bitbucketService = new BitbucketService();
