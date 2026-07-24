/**
 * Architecture Drift Snapshots API Route
 * Handles storing and retrieving architecture snapshots for historical analysis
 */

import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth, sanitizeError } from "@/lib/middleware";

export const runtime = "nodejs";

interface SnapshotRequest {
  repositoryId: string;
  snapshot: any;
}

interface SnapshotQueryResponse {
  repositoryId: string;
  snapshots: any[];
  totalSnapshots: number;
}

/**
 * POST - Store a new architecture snapshot
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const body: SnapshotRequest = await request.json();

    if (!body.repositoryId || !body.snapshot) {
      return NextResponse.json(
        { error: "Missing required fields: repositoryId, snapshot" },
        { status: 400 }
      );
    }

    // In a real implementation, store to database
    // For now, returning mock success
    const storedSnapshot = {
      ...body.snapshot,
      id: `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      storedAt: new Date().toISOString(),
    };

    return NextResponse.json(
      {
        success: true,
        message: "Snapshot stored successfully",
        snapshot: storedSnapshot,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (isHttpError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error storing snapshot:", error);
    return NextResponse.json({ error: sanitizeError(error) || "Failed to store snapshot" }, { status: 500 });
  }
}

/**
 * GET - Retrieve architecture snapshots for a repository
 * Query params:
 * - repositoryId: ID of the repository
 * - days: Number of days to look back (default: 30)
 * - limit: Maximum number of snapshots to return (default: 10)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const searchParams = request.nextUrl.searchParams;
    const repositoryId = searchParams.get("repositoryId");
    const days = parseInt(searchParams.get("days") || "30", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    if (!repositoryId) {
      return NextResponse.json(
        { error: "Missing required query parameter: repositoryId" },
        { status: 400 }
      );
    }

    // In a real implementation, query database for snapshots
    // For now, returning mock data
    const mockSnapshots = generateMockSnapshots(repositoryId, days, limit);

    const response: SnapshotQueryResponse = {
      repositoryId,
      snapshots: mockSnapshots,
      totalSnapshots: mockSnapshots.length,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    if (isHttpError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error retrieving snapshots:", error);
    return NextResponse.json({ error: sanitizeError(error) || "Failed to retrieve snapshots" }, { status: 500 });
  }
}

/**
 * DELETE - Remove old snapshots beyond retention period
 * Query params:
 * - repositoryId: ID of the repository
 * - olderThanDays: Delete snapshots older than this many days (default: 365)
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const searchParams = request.nextUrl.searchParams;
    const repositoryId = searchParams.get("repositoryId");
    const olderThanDays = parseInt(
      searchParams.get("olderThanDays") || "365",
      10
    );

    if (!repositoryId) {
      return NextResponse.json(
        { error: "Missing required query parameter: repositoryId" },
        { status: 400 }
      );
    }

    // In a real implementation, delete from database
    // For now, returning mock success

    return NextResponse.json(
      {
        success: true,
        message: `Deleted snapshots older than ${olderThanDays} days for repository ${repositoryId}`,
        deletedCount: Math.floor(Math.random() * 10),
      },
      { status: 200 }
    );
  } catch (error: any) {
    if (isHttpError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error deleting snapshots:", error);
    return NextResponse.json({ error: sanitizeError(error) || "Failed to delete snapshots" }, { status: 500 });
  }
}

/**
 * Generate mock snapshots for testing
 */
function generateMockSnapshots(
  repositoryId: string,
  days: number,
  limit: number
) {
  const snapshots = [];
  const now = new Date();

  for (let i = 0; i < Math.min(limit, Math.floor(days / 7)); i++) {
    const snapshotDate = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);

    snapshots.push({
      id: `snapshot-${repositoryId}-${i}`,
      repositoryId,
      timestamp: snapshotDate.toISOString(),
      snapshotDate: snapshotDate.toISOString().split("T")[0],
      dependencyGraph: [],
      totalDependencies: 20 + Math.floor(Math.random() * 30),
      violationCount: Math.floor(Math.random() * 5),
      moduleCount: 15 + Math.floor(Math.random() * 10),
      layerDistribution: {
        UI: Math.floor(Math.random() * 15),
        Services: Math.floor(Math.random() * 12),
        Database: Math.floor(Math.random() * 8),
        Auth: Math.floor(Math.random() * 5),
        API: Math.floor(Math.random() * 6),
        Utils: Math.floor(Math.random() * 10),
        Config: Math.floor(Math.random() * 3),
        Other: Math.floor(Math.random() * 5),
      },
      metadata: {
        analysisVersion: "1.0.0",
        analysisDurationMs: 1000 + Math.floor(Math.random() * 2000),
      },
    });
  }

  return snapshots.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
