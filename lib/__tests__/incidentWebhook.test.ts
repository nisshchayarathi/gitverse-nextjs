import crypto from "crypto";
import {
  parseIncidentTarget,
  verifyIncidentWebhookSignature,
} from "@/lib/utils/incidentWebhook";

describe("verifyIncidentWebhookSignature", () => {
  const secret = "incident-secret";
  const rawBody = JSON.stringify({ id: "evt_123", status: "triggered" });

  function sign(body: string, key = secret) {
    return "sha256=" + crypto.createHmac("sha256", key).update(body).digest("hex");
  }

  it("accepts a valid sha256 HMAC signature", () => {
    expect(
      verifyIncidentWebhookSignature({
        rawBody,
        signatureHeader: sign(rawBody),
        webhookSecret: secret,
      })
    ).toBe(true);
  });

  it("rejects missing secrets, missing signatures, and mismatched payloads", () => {
    expect(
      verifyIncidentWebhookSignature({
        rawBody,
        signatureHeader: sign(rawBody),
        webhookSecret: undefined,
      })
    ).toBe(false);

    expect(
      verifyIncidentWebhookSignature({
        rawBody,
        signatureHeader: null,
        webhookSecret: secret,
      })
    ).toBe(false);

    expect(
      verifyIncidentWebhookSignature({
        rawBody: `${rawBody}\n`,
        signatureHeader: sign(rawBody),
        webhookSecret: secret,
      })
    ).toBe(false);
  });
});

describe("parseIncidentTarget", () => {
  it("requires an explicit positive installation id, owner, and repo", () => {
    const params = new URLSearchParams({
      installationId: "42",
      owner: "octo-org",
      repo: "octo.repo",
    });

    expect(parseIncidentTarget(params)).toEqual({
      installationId: 42,
      owner: "octo-org",
      repo: "octo.repo",
    });
  });

  it("rejects missing defaults and unsafe repository identifiers", () => {
    expect(parseIncidentTarget(new URLSearchParams())).toBeNull();
    expect(
      parseIncidentTarget(
        new URLSearchParams({
          installationId: "1",
          owner: "../owner",
          repo: "repo",
        })
      )
    ).toBeNull();
  });
});
