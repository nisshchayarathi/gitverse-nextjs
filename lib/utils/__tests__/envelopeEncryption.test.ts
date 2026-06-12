/**
 * @jest-environment node
 */

const mockKmsGenerateDataKey = jest.fn();
const mockKmsDecrypt = jest.fn();

jest.mock("@/lib/utils/kmsProvider", () => ({
  getKmsProvider: () => ({
    generateDataKey: (...args: any[]) => mockKmsGenerateDataKey(...args),
    decrypt: (...args: any[]) => mockKmsDecrypt(...args),
    encrypt: jest.fn(),
  }),
}));

const mockDataEncryptionKeyFindFirst = jest.fn();
const mockDataEncryptionKeyCreate = jest.fn();
const mockDataEncryptionKeyUpdateMany = jest.fn();
const mockGithubAccountFindMany = jest.fn();
const mockGithubAccountUpdate = jest.fn();
const mockAccountFindMany = jest.fn();
const mockAccountUpdate = jest.fn();
const mockMfaConfigFindMany = jest.fn();
const mockMfaConfigUpdate = jest.fn();
const mockTransaction = jest.fn();

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    dataEncryptionKey: {
      findFirst: (...args: any[]) => mockDataEncryptionKeyFindFirst(...args),
      create: (...args: any[]) => mockDataEncryptionKeyCreate(...args),
      updateMany: (...args: any[]) => mockDataEncryptionKeyUpdateMany(...args),
    },
    gitHubAccount: {
      findMany: (...args: any[]) => mockGithubAccountFindMany(...args),
      update: (...args: any[]) => mockGithubAccountUpdate(...args),
    },
    account: {
      findMany: (...args: any[]) => mockAccountFindMany(...args),
      update: (...args: any[]) => mockAccountUpdate(...args),
    },
    mfaConfig: {
      findMany: (...args: any[]) => mockMfaConfigFindMany(...args),
      update: (...args: any[]) => mockMfaConfigUpdate(...args),
    },
    $transaction: (callback: any) => mockTransaction(callback),
  },
}));

import { rotateAndReEncryptAll, isKmsConfigured } from "../envelopeEncryption";

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("envelopeEncryption rotation tests", () => {
  it("throws error when KMS is not configured", async () => {
    delete process.env.KMS_KEY_ID;
    delete process.env.KMS_PROVIDER;

    await expect(rotateAndReEncryptAll()).rejects.toThrow("KMS must be configured");
  });

  it("rotates keys and re-encrypts database records successfully", async () => {
    process.env.KMS_KEY_ID = "arn:aws:kms:us-east-1:123456789012:key/test-key";
    process.env.KMS_PROVIDER = "aws";

    // 1. Mock KMS data key generation
    const oldPlaintext = Buffer.alloc(32, 1);
    const newPlaintext = Buffer.alloc(32, 2);
    
    mockKmsGenerateDataKey.mockResolvedValueOnce({
      plaintext: newPlaintext,
      ciphertext: Buffer.from("new-wrapped-key-ciphertext"),
    });

    // 2. Mock KMS decryption for the old key initialization
    mockKmsDecrypt.mockResolvedValue(oldPlaintext);

    // 3. Mock database active key lookup
    mockDataEncryptionKeyFindFirst.mockResolvedValue({
      id: "key-1",
      wrappedKey: Buffer.from("old-wrapped-key").toString("base64"),
      isActive: true,
    });

    // Helper to encrypt with old key so decryption inside utility works
    const encryptWithKey = (plain: string, key: Buffer) => {
      const crypto = require("crypto");
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      return Buffer.concat([iv, tag, encrypted]).toString("base64");
    };

    const oldEncryptedToken = encryptWithKey("github-access-token", oldPlaintext);

    // 4. Mock credentials retrieval
    mockGithubAccountFindMany.mockResolvedValue([
      { id: 1, accessToken: oldEncryptedToken, tokenEncrypted: true },
    ]);
    mockAccountFindMany.mockResolvedValue([]);
    mockMfaConfigFindMany.mockResolvedValue([]);

    // 5. Mock Transaction callback execution
    mockTransaction.mockImplementation(async (callback) => {
      const mockTx = {
        dataEncryptionKey: {
          updateMany: mockDataEncryptionKeyUpdateMany,
          create: mockDataEncryptionKeyCreate,
        },
        gitHubAccount: {
          update: mockGithubAccountUpdate,
        },
        account: {
          update: mockAccountUpdate,
        },
        mfaConfig: {
          update: mockMfaConfigUpdate,
        },
      };
      return await callback(mockTx);
    });

    const result = await rotateAndReEncryptAll();

    // Verify key generation
    expect(mockKmsGenerateDataKey).toHaveBeenCalledWith(
      "arn:aws:kms:us-east-1:123456789012:key/test-key",
      "AES_256"
    );

    // Verify database updates were triggered inside transaction
    expect(mockDataEncryptionKeyUpdateMany).toHaveBeenCalledWith({
      where: { isActive: true },
      data: { isActive: false },
    });

    expect(mockDataEncryptionKeyCreate).toHaveBeenCalledWith({
      data: {
        wrappedKey: Buffer.from("new-wrapped-key-ciphertext").toString("base64"),
        isActive: true,
      },
    });

    expect(mockGithubAccountUpdate).toHaveBeenCalledTimes(1);
    expect(mockGithubAccountUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        tokenEncrypted: true,
      }),
    });

    expect(result.githubAccountsCount).toBe(1);
    expect(result.accountsCount).toBe(0);
    expect(result.mfaConfigsCount).toBe(0);
    expect(result.newWrapped).toBe(Buffer.from("new-wrapped-key-ciphertext").toString("base64"));
  });
});
