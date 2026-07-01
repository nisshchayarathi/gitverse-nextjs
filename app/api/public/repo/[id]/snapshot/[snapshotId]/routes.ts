import { NextRequest, NextResponse } from "next/server";
import { publicSnapshotService } from "@/lib/services/publicSnapshotService";
import { logger } from "@/lib/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; snapshotId: string } }
) {
  const repositoryId = parseInt(params.id);
  const { snapshotId } = params;

  // Security and caching headers for public endpoint
  const securityHeaders = {
    "Cache-Control": "public, max-age=3600, must-revalidate", // Cache for 1 hour
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "ALLOW-FROM /", // Allow embedding in iframes
    "Content-Security-Policy": "frame-ancestors 'self'",
  };

  try {
    if (isNaN(repositoryId)) {
      return NextResponse.json(
        { error: "Invalid repository ID" },
        { status: 400, headers: securityHeaders }
      );
    }

    if (!snapshotId || typeof snapshotId !== "string") {
      return NextResponse.json(
        { error: "Invalid snapshot ID" },
        { status: 400, headers: securityHeaders }
      );
    }

    // Retrieve snapshot
    const snapshot = await publicSnapshotService.getSnapshot(
      repositoryId,
      snapshotId
    );

    // Snapshot not found or expired
    if (!snapshot) {
      logger.warn(
        { repositoryId, snapshotId },
        "Snapshot not found or expired (410 Gone)"
      );

      return NextResponse.json(
        {
          error: "Snapshot not found or has expired",
          message: "This snapshot has expired or been deleted. Request a new one from the repository owner.",
        },
        { 
          status: 410, // 410 Gone - resource no longer available
          headers: securityHeaders 
        }
      );
    }

    logger.info(
      { repositoryId, snapshotId, expiresAt: snapshot.expiresAt },
      "Public snapshot retrieved"
    );

    // Return snapshot data with metadata
    return NextResponse.json(
      {
        success: true,
        snapshot,
        expiresAt: snapshot.expiresAt.toISOString(),
        readOnly: true,
        message: "This is a read-only snapshot of the repository analysis.",
      },
      { 
        status: 200, 
        headers: securityHeaders 
      }
    );
  } catch (error: any) {
    logger.error(
      { repositoryId, snapshotId, error },
      "Failed to retrieve public snapshot"
    );

    return NextResponse.json(
      { error: "Failed to retrieve snapshot" },
      { 
        status: 500, 
        headers: securityHeaders 
      }
    );
  }
}

// DELETE: Allow snapshot creator to delete snapshot
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; snapshotId: string } }
) {
  // Note: Implement auth check here if you want to allow deletion
  // For now, return 405 Method Not Allowed
  return NextResponse.json(
    { error: "Deletion via API not allowed. Use the dashboard to manage snapshots." },
    { status: 405 }
  );
}