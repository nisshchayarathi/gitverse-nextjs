import { NextRequest, NextResponse } from "next/server";
import { requireAuth , sanitizeError } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await context.params;
    const user = await requireAuth(request);
    const id = parseInt(paramId, 10);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid repository ID" },
        { status: 400 }
      );
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
    console.error("Get repository stats error:", sanitizeError(error));
    return NextResponse.json(
      { error: "Failed to get repository statistics" },
      { status: 500 }
    );
  }
}
