/**
 * Tests for MFA secret encryption/decryption wrappers (lib/mfa.ts).
 *
 * These tests verify that:
 *   - `upsertMfaSecret` calls `encryptToken` before writing to the DB
 *   - `getDecryptedTotpSecret` calls `decryptToken` for encrypted rows
 *   - `getDecryptedTotpSecret` falls back to plaintext for legacy rows
 *   - `getDecryptedTotpSecret` returns `null` when no config exists
 *
 * The actual AES-256-GCM implementation is covered by
 * lib/utils/__tests__/tokenEncryption.test.ts — here we mock both
 * the encryption layer and Prisma to focus on orchestration logic.
 */

// ── Module Mocks ────────────────────────────────────────────────────────────

const mockEncryptToken = jest.fn();
const mockDecryptToken = jest.fn();

jest.mock("@/lib/utils/envelopeEncryption", () => ({
  encryptToken: (...args: any[]) => mockEncryptToken(...args),
  decryptToken: (...args: any[]) => mockDecryptToken(...args),
}));

const mockPrismaFindUnique = jest.fn();
const mockPrismaUpsert = jest.fn();
const mockPrismaDeleteMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    mfaConfig: {
      findUnique: (...args: any[]) => mockPrismaFindUnique(...args),
      upsert: (...args: any[]) => mockPrismaUpsert(...args),
      deleteMany: (...args: any[]) => mockPrismaDeleteMany(...args),
    },
  },
}));

// ── Imports (after mocks) ───────────────────────────────────────────────────

import { upsertMfaSecret, getDecryptedTotpSecret } from "@/lib/mfa";

// ── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe("upsertMfaSecret", () => {
  it("calls encryptToken with the plaintext secret", async () => {
    mockEncryptToken.mockResolvedValue("encrypted-value");
    mockPrismaUpsert.mockResolvedValue(undefined);

    await upsertMfaSecret(42, "PLAINTEXT-SECRET");

    expect(mockEncryptToken).toHaveBeenCalledTimes(1);
    expect(mockEncryptToken).toHaveBeenCalledWith("PLAINTEXT-SECRET");
  });

  it("stores the encrypted value and sets tokenEncrypted to true", async () => {
    mockEncryptToken.mockResolvedValue("encrypted-value");
    mockPrismaUpsert.mockResolvedValue(undefined);

    await upsertMfaSecret(42, "PLAINTEXT-SECRET");

    expect(mockPrismaUpsert).toHaveBeenCalledWith({
      where: { userId: 42 },
      create: {
        userId: 42,
        totpSecret: "encrypted-value",
        tokenEncrypted: true,
        isEnabled: false,
      },
      update: {
        totpSecret: "encrypted-value",
        tokenEncrypted: true,
        isEnabled: false,
      },
    });
  });

  it("passes the userId and secret to the Prisma upsert", async () => {
    mockEncryptToken.mockResolvedValue("encrypted-v2");
    mockPrismaUpsert.mockResolvedValue(undefined);

    await upsertMfaSecret(99, "SECRET-99");

    expect(mockPrismaUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 99 },
        create: expect.objectContaining({
          userId: 99,
          totpSecret: "encrypted-v2",
        }),
      }),
    );
  });

  it("propagates errors from encryptToken", async () => {
    mockEncryptToken.mockRejectedValue(new Error("Encryption failed"));
    mockPrismaUpsert.mockResolvedValue(undefined);

    await expect(upsertMfaSecret(42, "secret")).rejects.toThrow(
      "Encryption failed",
    );
    expect(mockPrismaUpsert).not.toHaveBeenCalled();
  });

  it("propagates errors from the database upsert", async () => {
    mockEncryptToken.mockResolvedValue("encrypted");
    mockPrismaUpsert.mockRejectedValue(new Error("DB error"));

    await expect(upsertMfaSecret(42, "secret")).rejects.toThrow("DB error");
  });
});

describe("getDecryptedTotpSecret", () => {
  it("returns null when no config exists", async () => {
    mockPrismaFindUnique.mockResolvedValue(null);

    const result = await getDecryptedTotpSecret(42);

    expect(result).toBeNull();
    expect(mockDecryptToken).not.toHaveBeenCalled();
  });

  it("returns null when config exists but totpSecret is null", async () => {
    mockPrismaFindUnique.mockResolvedValue({
      totpSecret: null,
      tokenEncrypted: false,
    });

    const result = await getDecryptedTotpSecret(42);
    expect(result).toBeNull();
  });

  it("returns null when config exists but totpSecret is an empty string", async () => {
    mockPrismaFindUnique.mockResolvedValue({
      totpSecret: "",
      tokenEncrypted: true,
    });

    const result = await getDecryptedTotpSecret(42);
    expect(result).toBeNull();
    expect(mockDecryptToken).not.toHaveBeenCalled();
  });

  it("returns plaintext when tokenEncrypted is false (legacy row)", async () => {
    mockPrismaFindUnique.mockResolvedValue({
      totpSecret: "LEGACY-PLAINTEXT",
      tokenEncrypted: false,
    });

    const result = await getDecryptedTotpSecret(42);

    expect(result).toBe("LEGACY-PLAINTEXT");
    expect(mockDecryptToken).not.toHaveBeenCalled();
  });

  it("calls decryptToken when tokenEncrypted is true", async () => {
    mockDecryptToken.mockResolvedValue("DECRYPTED-SECRET");
    mockPrismaFindUnique.mockResolvedValue({
      totpSecret: "encrypted-blob",
      tokenEncrypted: true,
    });

    const result = await getDecryptedTotpSecret(42);

    expect(mockDecryptToken).toHaveBeenCalledTimes(1);
    expect(mockDecryptToken).toHaveBeenCalledWith("encrypted-blob");
    expect(result).toBe("DECRYPTED-SECRET");
  });

  it("selects both totpSecret and tokenEncrypted fields", async () => {
    mockDecryptToken.mockResolvedValue("decrypted");
    mockPrismaFindUnique.mockResolvedValue({
      totpSecret: "encrypted",
      tokenEncrypted: true,
    });

    await getDecryptedTotpSecret(42);

    expect(mockPrismaFindUnique).toHaveBeenCalledWith({
      where: { userId: 42 },
      select: { totpSecret: true, tokenEncrypted: true },
    });
  });

  it("propagates errors from decryptToken", async () => {
    mockDecryptToken.mockRejectedValue(new Error("Decryption failed"));
    mockPrismaFindUnique.mockResolvedValue({
      totpSecret: "bad-encrypted",
      tokenEncrypted: true,
    });

    await expect(getDecryptedTotpSecret(42)).rejects.toThrow(
      "Decryption failed",
    );
  });
});
