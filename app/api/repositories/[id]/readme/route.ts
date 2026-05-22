import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/api-auth";
import { repositoryService } from "@/lib/services/repositoryService";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth(request);
    const id = Number(params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Invalid repository ID. Must be a positive integer." },
        { status: 400 },
      );
    }

    const repository = await repositoryService.fetchAndStoreReadme(
      id,
      user.userId,
    );

    return NextResponse.json({
      repository: {
        id: repository.id,
        readmePath: repository.readmePath,
        readmeText: repository.readmeText,
        readmeFetchedAt: repository.readmeFetchedAt,
      },
    });
  } catch (error: any) {
    console.error("Fetch README error:", error);

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    if (error?.message === "Repository not found") {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to fetch README" },
      { status: 500 },
    );
  }
}
