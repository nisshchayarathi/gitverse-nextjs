"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubAppService = void 0;
const axios_1 = __importDefault(require("axios"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function getRequiredEnv(name) {
    const value = process.env[name];
    if (!value?.trim()) {
        throw new Error(`${name} is required`);
    }
    return value;
}
function normalizePrivateKey(value) {
    // Common deployment pattern: store multiline key with literal "\n".
    return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}
class GitHubAppService {
    appId;
    privateKey;
    cachedJwt = null;
    cachedJwtExpiresAt = 0;
    constructor(opts) {
        this.appId = opts?.appId || getRequiredEnv("GITHUB_APP_ID");
        this.privateKey = normalizePrivateKey(opts?.privateKey || getRequiredEnv("GITHUB_APP_PRIVATE_KEY"));
    }
    createAppJwt() {
        const now = Math.floor(Date.now() / 1000);
        // Reuse cached JWT if still valid for at least 60 more seconds
        if (this.cachedJwt &&
            now < this.cachedJwtExpiresAt - 60) {
            return this.cachedJwt;
        }
        const expiresAt = now + 9 * 60;
        const payload = {
            iat: now - 60,
            exp: expiresAt,
            iss: this.appId,
        };
        const token = jsonwebtoken_1.default.sign(payload, this.privateKey, {
            algorithm: "RS256",
        });
        this.cachedJwt = token;
        this.cachedJwtExpiresAt = expiresAt;
        return token;
    }
    async getInstallationAccessToken(installationId) {
        if (!Number.isFinite(installationId)) {
            throw new Error("installationId must be a number");
        }
        const appJwt = this.createAppJwt();
        const response = await axios_1.default.post(`https://api.github.com/app/installations/${installationId}/access_tokens`, {}, {
            headers: {
                Authorization: `Bearer ${appJwt}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "GitVerse-App",
            },
        });
        const token = response.data?.token;
        if (!token) {
            throw new Error("Failed to obtain installation access token");
        }
        return token;
    }
    async uninstallInstallation(installationId) {
        if (!Number.isFinite(installationId)) {
            throw new Error("installationId must be a number");
        }
        const appJwt = this.createAppJwt();
        await axios_1.default.delete(`https://api.github.com/app/installations/${installationId}`, {
            headers: {
                Authorization: `Bearer ${appJwt}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "GitVerse-App",
            },
        });
    }
}
exports.GitHubAppService = GitHubAppService;
