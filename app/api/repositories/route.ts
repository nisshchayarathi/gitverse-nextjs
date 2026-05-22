import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";
import { analysisJobService } from "@/lib/services/analysisJobService";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { name, url, description } = body;

    console.log("Create repository request:", {
      name,
      url,
      userId: user.userId,
    });

    if (!name || !url) {
      return NextResponse.json(
        { error: "Name and URL are required" },
        { status: 400 }
      );
    }

    // Validate URL format
    const urlPattern = /^https?:\/\/.+/;
    if (!urlPattern.test(url)) {
      return NextResponse.json(
        { error: "Invalid repository URL" },
        { status: 400 }
      );
    }

    const repository = await repositoryService.createRepository({
      name,
      url,
      description,
      userId: user.userId,
    });

    console.log("Repository created:", repository.id);

    const job = await analysisJobService.createRepositoryAnalysisJob({
      repositoryId: repository.id,
      userId: user.userId,
    });

    return NextResponse.json(
      { repository, jobId: job.id, jobStatus: job.status },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create repository error:", error);
    console.error("Error stack:", error.stack);
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Failed to create repository", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const repositories = await repositoryService.listRepositories(user.userId);

    return NextResponse.json({ repositories });
  } catch (error: any) {
    console.error("List repositories error:", error);
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Failed to list repositories" },
      { status: 500 }
    );
  }
}
