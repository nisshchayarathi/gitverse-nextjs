import { GithubWebhookVerifier } from "@/lib/services/githubWebhookVerifier";
import { NextRequest } from "next/server";
import crypto from "crypto";

describe("GithubWebhookVerifier", () => {
  const secret = "test-secret";
  const rawBody = JSON.stringify({ action: "test" });
  
  beforeAll(() => {
    process.env.GITHUB_WEBHOOK_SECRET = secret;
  });

  afterAll(() => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
  });

  it("should return true for a valid signature", async () => {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(rawBody, "utf8");
    const validSignature = `sha256=${hmac.digest("hex")}`;

    const req = new NextRequest("http://localhost/api/webhook", {
      method: "POST",
      headers: {
        "x-hub-signature-256": validSignature,
      },
    });

    const isValid = await GithubWebhookVerifier.verifySignature(req, rawBody);
    expect(isValid).toBe(true);
  });

  it("should return false for an invalid signature", async () => {
    const req = new NextRequest("http://localhost/api/webhook", {
      method: "POST",
      headers: {
        "x-hub-signature-256": "sha256=invalidhashvalue",
      },
    });

    const isValid = await GithubWebhookVerifier.verifySignature(req, rawBody);
    expect(isValid).toBe(false);
  });

  it("should return false if signature header is missing", async () => {
    const req = new NextRequest("http://localhost/api/webhook", {
      method: "POST",
    });

    const isValid = await GithubWebhookVerifier.verifySignature(req, rawBody);
    expect(isValid).toBe(false);
  });
});
