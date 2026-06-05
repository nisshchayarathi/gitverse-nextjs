import { RedactSensitiveFields } from "../../../services/security/redact-sensitive-fields";

describe("OAuth Token Exposure Sanitization Engine", () => {
  describe("RedactSensitiveFields Service", () => {
    it("Scenario 1: removes sensitive fields such as accessToken, passwordHash, and secrets from object payload", () => {
      const sensitiveData = {
        id: 42,
        name: "Alice",
        email: "alice@example.com",
        passwordHash: "$2a$10$UnObtainAblePasswordHashValue123",
        githubAccount: {
          id: 1,
          username: "alice-git",
          accessToken: "gho_SuperSecretUnencryptedOrEncryptedTokenPayload",
          tokenEncrypted: true,
        },
      };

      const redacted = RedactSensitiveFields.redact(sensitiveData);

      expect(redacted.id).toBe(42);
      expect(redacted.name).toBe("Alice");
      expect(redacted.email).toBe("alice@example.com");
      expect(redacted.passwordHash).toBeUndefined();
      expect(redacted.githubAccount.id).toBe(1);
      expect(redacted.githubAccount.username).toBe("alice-git");
      expect(redacted.githubAccount.accessToken).toBeUndefined();
      expect(redacted.githubAccount.tokenEncrypted).toBeUndefined();
    });

    it("Scenario 2: Connected account response contains no OAuth credentials or tokens", () => {
      const connectedAccountPayload = {
        id: 777,
        userId: 12,
        githubUserId: "998877",
        username: "git-dev",
        accessToken: "gho_TokenExposureValue",
        refreshToken: "ghr_RefreshTokenExposureValue",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const redacted = RedactSensitiveFields.redact(connectedAccountPayload);

      expect(redacted.id).toBe(777);
      expect(redacted.userId).toBe(12);
      expect(redacted.githubUserId).toBe("998877");
      expect(redacted.username).toBe("git-dev");
      expect(redacted.accessToken).toBeUndefined();
      expect(redacted.refreshToken).toBeUndefined();
    });

    it("Scenario 3: Preserves non-sensitive datatypes like Date objects and basic lists", () => {
      const now = new Date();
      const payload = {
        items: [{ id: 1, name: "repo1", secret: "super-secret" }],
        timestamp: now,
      };

      const redacted = RedactSensitiveFields.redact(payload);

      expect(redacted.items[0].id).toBe(1);
      expect(redacted.items[0].name).toBe("repo1");
      expect(redacted.items[0].secret).toBeUndefined();
      expect(redacted.timestamp).toBeInstanceOf(Date);
      expect(redacted.timestamp.getTime()).toBe(now.getTime());
    });

    it("Scenario 4: Backend services can still access the raw token (tokens are available internally only)", () => {
      const databaseRecord = {
        userId: 10,
        accessToken: "gho_InternallyStoredOAuthToken",
        tokenEncrypted: false,
      };

      // Internal model is accessed securely
      const internalToken = databaseRecord.accessToken;
      expect(internalToken).toBe("gho_InternallyStoredOAuthToken");

      // When serialized to client DTO
      const publicDto = RedactSensitiveFields.redact(databaseRecord);
      expect(publicDto.accessToken).toBeUndefined();
    });
  });
});
