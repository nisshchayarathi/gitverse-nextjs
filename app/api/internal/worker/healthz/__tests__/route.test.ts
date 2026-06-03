/**
 * @jest-environment node
 */

var mockCheckEncryptionHealth: jest.Mock;

jest.mock("@/lib/utils/tokenEncryption", () => {
  mockCheckEncryptionHealth = jest.fn();
  return {
    checkEncryptionHealth: mockCheckEncryptionHealth,
  };
});

jest.mock("@/lib/utils/internalAuth", () => ({
  isInternalWorkerAuthorized: jest.fn().mockReturnValue(true),
  validateRequiredSecrets: jest.fn().mockReturnValue([]),
  validateSecretIsolation: jest.fn().mockReturnValue([]),
}));

import { GET } from "../route";
import { isInternalWorkerAuthorized } from "@/lib/utils/internalAuth";
import { NextRequest } from "next/server";

function mockRequest(authHeader?: string): NextRequest {
  return {
    headers: new Map(authHeader ? [["authorization", authHeader]] : []),
  } as unknown as NextRequest;
}

describe("GET /api/internal/worker/healthz – encryption check", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INTERNAL_WORKER_SECRET = "test-secret-value";
    mockCheckEncryptionHealth.mockReturnValue({
      healthy: true,
      message: "Encryption is properly configured",
    });
  });

  afterEach(() => {
    delete process.env.INTERNAL_WORKER_SECRET;
  });

  it("returns healthy when encryption is configured", async () => {
    const res = await GET(mockRequest("Bearer test-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.checks.tokenEncryption).toEqual({ status: "ok" });
  });

  it("returns unhealthy when encryption is not configured", async () => {
    mockCheckEncryptionHealth.mockReturnValue({
      healthy: false,
      message: "TOKEN_ENCRYPTION_KEY is not set",
    });

    const res = await GET(mockRequest("Bearer test-secret"));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("unhealthy");
    expect(body.checks.tokenEncryption).toEqual({
      status: "error",
      message: "TOKEN_ENCRYPTION_KEY is not set",
    });
  });

  it("returns unhealthy when encryption round-trip fails", async () => {
    mockCheckEncryptionHealth.mockReturnValue({
      healthy: false,
      message: "Encrypt/decrypt round-trip failed",
    });

    const res = await GET(mockRequest("Bearer test-secret"));
    const body = await res.json();

    expect(body.status).toBe("unhealthy");
    expect(body.checks.tokenEncryption.status).toBe("error");
  });

  it("includes encryption check in the checks object", async () => {
    const res = await GET(mockRequest("Bearer test-secret"));
    const body = await res.json();

    expect(body.checks).toHaveProperty("tokenEncryption");
  });

  it("fails health check when INTERNAL_WORKER_SECRET is missing even if encryption is ok", async () => {
    delete process.env.INTERNAL_WORKER_SECRET;
    const { validateRequiredSecrets } = require("@/lib/utils/internalAuth");
    (validateRequiredSecrets as jest.Mock).mockReturnValueOnce(["INTERNAL_WORKER_SECRET"]);

    const res = await GET(mockRequest("Bearer test-secret"));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("unhealthy");
    expect(body.checks.secrets.status).toBe("error");
  });

  it("encryption failure alone makes overall health unhealthy", async () => {
    mockCheckEncryptionHealth.mockReturnValue({
      healthy: false,
      message: "TOKEN_ENCRYPTION_KEY is not set",
    });

    const res = await GET(mockRequest("Bearer test-secret"));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("unhealthy");
  });

  it("authorization failure returns 401 before any checks", async () => {
    (isInternalWorkerAuthorized as jest.Mock).mockReturnValueOnce(false);

    const res = await GET(mockRequest("Bearer wrong-secret"));

    expect(res.status).toBe(401);
  });
});
