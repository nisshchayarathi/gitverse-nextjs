/**
 * Tests for GET /api/internal/worker/healthz
 *
 * Verifies the health check endpoint:
 * - Requires authentication
 * - Checks for required secrets
 * - Validates secret isolation
 * - Returns proper health status
 */

jest.mock("@/lib/utils/internalAuth", () => ({
  isInternalWorkerAuthorized: jest.fn(),
  validateRequiredSecrets: jest.fn(),
  validateSecretIsolation: jest.fn(),
}));

import { GET } from "../route";
import {
  isInternalWorkerAuthorized,
  validateRequiredSecrets,
  validateSecretIsolation,
} from "@/lib/utils/internalAuth";
import { NextRequest } from "next/server";

describe("GET /api/internal/worker/healthz", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INTERNAL_WORKER_SECRET = "test-secret";
  });

  afterEach(() => {
    delete process.env.INTERNAL_WORKER_SECRET;
  });

  it("returns 401 when not authorized", async () => {
    (isInternalWorkerAuthorized as jest.Mock).mockReturnValue(false);

    const request = new NextRequest("http://localhost/api/internal/worker/healthz");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 200 when healthy", async () => {
    (isInternalWorkerAuthorized as jest.Mock).mockReturnValue(true);
    (validateRequiredSecrets as jest.Mock).mockReturnValue([]);
    (validateSecretIsolation as jest.Mock).mockReturnValue([]);

    const request = new NextRequest("http://localhost/api/internal/worker/healthz");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("healthy");
    expect(data.checks.secrets.status).toBe("ok");
    expect(data.checks.isolation.status).toBe("ok");
  });

  it("returns 503 when secrets are missing", async () => {
    (isInternalWorkerAuthorized as jest.Mock).mockReturnValue(true);
    (validateRequiredSecrets as jest.Mock).mockReturnValue([
      "INTERNAL_WORKER_SECRET",
    ]);
    (validateSecretIsolation as jest.Mock).mockReturnValue([]);

    const request = new NextRequest("http://localhost/api/internal/worker/healthz");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("unhealthy");
    expect(data.checks.secrets.status).toBe("error");
  });

  it("returns warning when secrets are not isolated", async () => {
    (isInternalWorkerAuthorized as jest.Mock).mockReturnValue(true);
    (validateRequiredSecrets as jest.Mock).mockReturnValue([]);
    (validateSecretIsolation as jest.Mock).mockReturnValue([
      "INTERNAL_WORKER_SECRET should differ from GITHUB_WEBHOOK_SECRET",
    ]);

    const request = new NextRequest("http://localhost/api/internal/worker/healthz");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("healthy");
    expect(data.checks.isolation.status).toBe("warning");
    expect(data.checks.isolation.message).toContain("should differ");
  });

  it("includes timestamp in response", async () => {
    (isInternalWorkerAuthorized as jest.Mock).mockReturnValue(true);
    (validateRequiredSecrets as jest.Mock).mockReturnValue([]);
    (validateSecretIsolation as jest.Mock).mockReturnValue([]);

    const request = new NextRequest("http://localhost/api/internal/worker/healthz");
    const response = await GET(request);
    const data = await response.json();

    expect(data.timestamp).toBeDefined();
    expect(new Date(data.timestamp)).toBeInstanceOf(Date);
  });
});
