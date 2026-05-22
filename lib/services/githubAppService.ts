import axios, { isAxiosError } from "axios";
import jwt from "jsonwebtoken";
import { withRetry, extractRetryAfter } from "@/lib/utils/rateLimit";
import { GitHubRateLimitError } from "@/lib/services/githubService";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function normalizePrivateKey(value: string): string {
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

function sanitizeAppError(error: any) {
  if (isAxiosError(error) && error.config) {
    const safeConfig = {
      ...error.config,
      headers: error.config.headers
        ? {
            ...error.config.headers,
            Authorization: "[REDACTED]",
          }
        : error.config.headers,
    };
    error.config = safeConfig as any;
  }
  return error;
}

export class GitHubAppService {
  private appId: string;
  private privateKey: string;

  constructor(opts?: { appId?: string; privateKey?: string }) {
    this.appId = opts?.appId || getRequiredEnv("GITHUB_APP_ID");
    this.privateKey = normalizePrivateKey(
      opts?.privateKey || getRequiredEnv("GITHUB_APP_PRIVATE_KEY"),
    );
  }

  createAppJwt(): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60,
      exp: now + 9 * 60,
      iss: this.appId,
    };

    return jwt.sign(payload, this.privateKey, { algorithm: "RS256" });
  }

  async getInstallationAccessToken(installationId: number): Promise<string> {
    if (!Number.isFinite(installationId)) {
      throw new Error("installationId must be a number");
    }

    const appJwt = this.createAppJwt();
    try {
      return await withRetry(
        async () => {
          const response = await axios.post(
            `https://api.github.com/app/installations/${installationId}/access_tokens`,
            {},
            {
              headers: {
                Authorization: `Bearer ${appJwt}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
              },
            },
          );

          const token = response.data?.token as string | undefined;
          if (!token) {
            throw new Error("Failed to obtain installation access token");
          }
          return token;
        },
        {
          maxRetries: 3,
          onRetry: (attempt, _err, delayMs) => {
            console.warn(`[GitHubAppService] Retrying access token fetch for installation ${installationId} (attempt ${attempt}) in ${delayMs}ms`);
          }
        }
      );
    } catch (err: any) {
      if (isAxiosError(err) && err.response?.status === 429) {
        throw new GitHubRateLimitError(extractRetryAfter(err) ?? 60);
      }
      throw sanitizeAppError(err);
    }
  }

  async uninstallInstallation(installationId: number): Promise<void> {
    if (!Number.isFinite(installationId)) {
      throw new Error("installationId must be a number");
    }

    const appJwt = this.createAppJwt();
    try {
      await withRetry(
        async () => {
          await axios.delete(
            `https://api.github.com/app/installations/${installationId}`,
            {
              headers: {
                Authorization: `Bearer ${appJwt}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
              },
            },
          );
        },
        {
          maxRetries: 3,
          onRetry: (attempt, _err, delayMs) => {
            console.warn(`[GitHubAppService] Retrying uninstall for installation ${installationId} (attempt ${attempt}) in ${delayMs}ms`);
          }
        }
      );
    } catch (err: any) {
      if (isAxiosError(err) && err.response?.status === 429) {
        throw new GitHubRateLimitError(extractRetryAfter(err) ?? 60);
      }
      throw sanitizeAppError(err);
    }
  }
}
