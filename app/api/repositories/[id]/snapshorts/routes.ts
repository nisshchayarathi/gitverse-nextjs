import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isHttpError, sanitizeError } from "@/lib/middleware";
import prisma from "@/lib/prisma";
import { publicSnapshotService } from "@/lib/services/publicSnapshotService";
import { logger } from "@/lib/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const securityHeaders = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "X-Content-Type-Options": "nosniff",
  };

  try {
    // Authenticate user
    const user = await requireAuth(request);
    const repositoryId = parseInt(params.id);

    if (isNaN(repositoryId)) {
      return NextResponse.json(
        { error: "Invalid repository ID" },
        { status: 400, headers: securityHeaders }
      );
    }

    // Verify repository exists and user owns it
    const repository = await prisma.repository.findUnique({
      where: { id: repositoryId },
    });

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404, headers: securityHeaders }
      );
    }

    if (repository.userId !== user.userId) {
      return NextResponse.json(
        { error: "Unauthorized: You can only create snapshots for your own repositories" },
        { status: 403, headers: securityHeaders }
      );
    }

    // Check rate limit: 10 snapshots per hour per user
    const isRateLimited = await publicSnapshotService.checkSnapshotRateLimit(
      user.userId
    );

    if (isRateLimited) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: "You can create maximum 10 snapshots per hour. Please try again later.",
          retryAfter: 3600,
        },
        { 
          status: 429, 
          headers: { 
            ...securityHeaders,
            "Retry-After": "3600",
          } 
        }
      );
    }

    // Get TTL from request body (optional, defaults to 30 days)
    let ttlHours = 24 * 30; // 30 days default
    try {
      const body = await request.json();
      if (body.ttlHours && typeof body.ttlHours === "number") {
        ttlHours = Math.min(Math.max(body.ttlHours, 1), 24 * 365); // Between 1 hour and 1 year
      }
    } catch {
      // No body or invalid JSON, use default TTL
    }

    // Create snapshot
    const { snapshotId, url } = await publicSnapshotService.createSnapshot(
      repositoryId,
      user.userId,
      ttlHours
    );

    logger.info(
      { repositoryId, userId: user.userId, snapshotId, ttlHours },
      "Snapshot created via API"
    );

    return NextResponse.json(
      {
        success: true,
        snapshotId,
        url,
        message: "Public snapshot created successfully. Share this URL with contributors!",
        expiresInHours: ttlHours,
      },
      { status: 201, headers: securityHeaders }
    );
  } catch (error: any) {
    logger.error(
      { params, error: sanitizeError(error) },
      "Failed to create snapshot"
    );

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: securityHeaders }
      );
    }

    return NextResponse.json(
      { error: "Failed to create snapshot" },
      { status: 500, headers: securityHeaders }
    );
  }
}

// GET: List all snapshots for a repository
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const securityHeaders = {
    "Cache-Control": "public, max-age=60", // Cache snapshot list for 1 minute
    "X-Content-Type-Options": "nosniff",
  };

  try {
    const user = await requireAuth(request);
    const repositoryId = parseInt(params.id);

    if (isNaN(repositoryId)) {
      return NextResponse.json(
        { error: "Invalid repository ID" },
        { status: 400, headers: securityHeaders }
      );
    }

    // Verify repository exists
    const repository = await prisma.repository.findUnique({
      where: { id: repositoryId },
    });

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404, headers: securityHeaders }
      );
    }

    // Only repo owner can list snapshots
    if (repository.userId !== user.userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403, headers: securityHeaders }
      );
    }

    const snapshots = await publicSnapshotService.getSnapshotsForRepository(
      repositoryId,
      user.userId
    );

    // Get metrics
    const metrics = await publicSnapshotService.getSnapshotMetrics(repositoryId);

    return NextResponse.json(
      {
        snapshots,
        metrics,
      },
      { headers: securityHeaders }
    );
  } catch (error: any) {
    logger.error(
      { params, error: sanitizeError(error) },
      "Failed to list snapshots"
    );

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: securityHeaders }
      );
    }

    return NextResponse.json(
      { error: "Failed to list snapshots" },
      { status: 500, headers: securityHeaders }
    );
  }
}