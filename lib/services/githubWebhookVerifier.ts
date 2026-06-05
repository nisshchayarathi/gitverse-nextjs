import crypto from "crypto";
import { NextRequest } from "next/server";

export class GithubWebhookVerifier {
  public static async verifySignature(request: NextRequest, rawBody: string): Promise<boolean> {
    const signature = request.headers.get("x-hub-signature-256");
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    if (!signature || !secret) {
      return false;
    }

    try {
      const hmac = crypto.createHmac("sha256", secret);
      hmac.update(rawBody, "utf8");
      const expectedSignature = `sha256=${hmac.digest("hex")}`;

      const a = Buffer.from(expectedSignature);
      const b = Buffer.from(signature);

      if (a.length !== b.length) {
        return false;
      }

      return crypto.timingSafeEqual(a, b);
    } catch (e) {
      console.error("Webhook signature verification failed:", e);
      return false;
    }
  }
}
