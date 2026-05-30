import axios from "axios";
import jwt from "jsonwebtoken";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function normalizePrivateKey(value: string): string {
  // Common deployment pattern: store multiline key with literal "\n".
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

export class GitHubAppService {
  private appId: string;
  private privateKey: string;

  private cachedJwt: string | null = null;
  private cachedJwtExpiresAt = 0;
  constructor(opts?: { appId?: string; privateKey?: string }) {
    this.appId = opts?.appId || getRequiredEnv("GITHUB_APP_ID");
    this.privateKey = normalizePrivateKey(
      opts?.privateKey || getRequiredEnv("GITHUB_APP_PRIVATE_KEY"),
    );
  }

  createAppJwt(): string {
    const now = Math.floor(Date.now() / 1000);

    // Reuse cached JWT if still valid for at least 60 more seconds
    if (
      this.cachedJwt &&
      now < this.cachedJwtExpiresAt - 60
    ) {
      return this.cachedJwt;
    }

    const expiresAt = now + 9 * 60;

    const payload = {
      iat: now - 60,
      exp: expiresAt,
      iss: this.appId,
    };

    const token = jwt.sign(payload, this.privateKey, {
      algorithm: "RS256",
    });

    this.cachedJwt = token;
    this.cachedJwtExpiresAt = expiresAt;

    return token;
  }

  async getInstallationAccessToken(installationId: number): Promise<string> {
    if (!Number.isFinite(installationId)) {
      throw new Error("installationId must be a number");
    }

    const appJwt = this.createAppJwt();
    const response = await axios.post(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {},
      {
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "GitVerse-App",
        },
      },
    );

    const token = response.data?.token as string | undefined;
    if (!token) {
      throw new Error("Failed to obtain installation access token");
    }
    return token;
  }

  async uninstallInstallation(installationId: number): Promise<void> {
    if (!Number.isFinite(installationId)) {
      throw new Error("installationId must be a number");
    }

    const appJwt = this.createAppJwt();
    await axios.delete(
      `https://api.github.com/app/installations/${installationId}`,
      {
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "GitVerse-App",
        },
      },
    );
  }
}
