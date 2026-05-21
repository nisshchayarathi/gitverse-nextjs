import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid repository ID" },
        { status: 400 }
      );
    }

    const stats = await repositoryService.getRepositoryStats(id, user.userId);

    return NextResponse.json({ stats });
  } catch (error: any) {
    console.error("Get repository stats error:", error);
    return NextResponse.json(
      { error: "Failed to get repository statistics" },
      { status: 500 }
    );
  }
}
