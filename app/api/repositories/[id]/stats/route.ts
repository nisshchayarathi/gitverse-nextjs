import { NextRequest, NextResponse } from "next/server";
import { requireAuth , sanitizeError } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";
import { apiError } from "@/lib/api-error";
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return apiError(400, "Invalid repository ID");
    }

    const stats = await repositoryService.getRepositoryStats(id, user.userId);

    if (!stats) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ stats }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
      },
    });
  } catch (error: any) {
    console.error("Get repository stats error:", error);
    return apiError(500, "Failed to get repository statistics");
  }
}
