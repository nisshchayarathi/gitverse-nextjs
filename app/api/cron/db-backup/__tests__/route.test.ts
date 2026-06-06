import { NextRequest } from "next/server";
import { GET } from "../route";

const mockIsCronAuthorized = jest.fn();
const mockHandleBackup = jest.fn();

jest.mock("@/lib/utils/internalAuth", () => ({
  isCronAuthorized: (...args: any[]) => mockIsCronAuthorized(...args),
}));

jest.mock("@/lib/services/backupService", () => ({
  handleBackup: (...args: any[]) => mockHandleBackup(...args),
}));

function mockRequest(authHeader?: string): NextRequest {
  return {
    headers: {
      get: (name: string) =>
        name === "authorization" ? authHeader || null : null,
    },
  } as unknown as NextRequest;
}

const successResult = {
  success: true,
  backupId: "backup-2026-06-06T00-00-00-abc12345",
  location: "/tmp/db-backups/backup-2026-06-06T00-00-00-abc12345.sql.gz",
  sizeBytes: 1048576,
  checksumSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  timestamp: "2026-06-06T00:00:00.000Z",
  durationMs: 4523,
  compressed: true,
};

const failureResult = {
  success: false,
  backupId: "backup-2026-06-06T00-00-00-def67890",
  timestamp: "2026-06-06T00:00:00.000Z",
  durationMs: 1200,
  compressed: false,
  error: "pg_dump exited with code 1",
};

describe("GET /api/cron/db-backup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not authorized", async () => {
    mockIsCronAuthorized.mockReturnValue(false);

    const response = await GET(mockRequest());
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 with invalid bearer token", async () => {
    mockIsCronAuthorized.mockReturnValue(false);

    const response = await GET(mockRequest("Bearer invalid-secret"));
    expect(response.status).toBe(401);
  });

  it("calls isCronAuthorized with the authorization header", async () => {
    mockIsCronAuthorized.mockReturnValue(true);
    mockHandleBackup.mockResolvedValue(successResult);

    await GET(mockRequest("Bearer valid-secret"));

    expect(mockIsCronAuthorized).toHaveBeenCalledWith("Bearer valid-secret");
  });

  it("returns 200 with backup details on success", async () => {
    mockIsCronAuthorized.mockReturnValue(true);
    mockHandleBackup.mockResolvedValue(successResult);

    const response = await GET(mockRequest("Bearer valid-secret"));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.backupId).toBe(successResult.backupId);
    expect(body.location).toBe(successResult.location);
    expect(body.sizeBytes).toBe(1048576);
    expect(body.checksumSha256).toBe(successResult.checksumSha256);
    expect(body.durationMs).toBe(4523);
  });

  it("returns 200 with backup stored on S3", async () => {
    mockIsCronAuthorized.mockReturnValue(true);
    mockHandleBackup.mockResolvedValue({
      ...successResult,
      location: "s3://backup-bucket/db-backups/2026-06-06T00-00-00_abc12345.sql.gz",
    });

    const response = await GET(mockRequest("Bearer valid-secret"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.location).toContain("s3://");
  });

  it("returns 500 when handleBackup reports failure", async () => {
    mockIsCronAuthorized.mockReturnValue(true);
    mockHandleBackup.mockResolvedValue(failureResult);

    const response = await GET(mockRequest("Bearer valid-secret"));
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("pg_dump exited with code 1");
    expect(body.backupId).toBeDefined();
  });

  it("returns 500 when handleBackup throws", async () => {
    mockIsCronAuthorized.mockReturnValue(true);
    mockHandleBackup.mockRejectedValue(new Error("Unexpected crash"));

    const response = await GET(mockRequest("Bearer valid-secret"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Database backup failed");
  });

  it("includes durationMs in success response", async () => {
    mockIsCronAuthorized.mockReturnValue(true);
    mockHandleBackup.mockResolvedValue(successResult);

    const response = await GET(mockRequest("Bearer valid-secret"));
    const body = await response.json();
    expect(body.durationMs).toBeGreaterThan(0);
  });

  it("includes a valid backupId even in failure response", async () => {
    mockIsCronAuthorized.mockReturnValue(true);
    mockHandleBackup.mockResolvedValue(failureResult);

    const response = await GET(mockRequest("Bearer valid-secret"));
    const body = await response.json();
    expect(body.backupId).toMatch(/^backup-/);
  });

  it("handles empty authorization header", async () => {
    mockIsCronAuthorized.mockReturnValue(false);

    const response = await GET(mockRequest(""));
    expect(response.status).toBe(401);
  });

  it("handles missing authorization header", async () => {
    mockIsCronAuthorized.mockReturnValue(false);

    const response = await GET(mockRequest());
    expect(response.status).toBe(401);
  });
});
