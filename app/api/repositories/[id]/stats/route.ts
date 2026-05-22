import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Invalid repository ID. Must be a positive integer." },
        { status: 400 }
      );
    }

    const user = await requireAuth(request);

    const stats = await repositoryService.getRepositoryStats(id, user.userId);

    return NextResponse.json({ stats });
  } catch (error: any) {
    console.error("Get repository stats error:", error);
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    if (error?.message === "Repository not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to get repository statistics" },
      { status: 500 }
    );
  }
}
