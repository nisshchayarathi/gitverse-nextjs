import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/api-auth";
import { repositoryService } from "@/lib/services/repositoryService";
import { analysisJobService } from "@/lib/services/analysisJobService";
import { getRepositories } from "@/lib/services/repositoryService";
import type { PaginatedResponse } from "@/types/pagination";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json(
        { error: "Malformed JSON body" },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }

    const { name, url, description } = body;

    console.log("Create repository request:", {
      name,
      userId: user.userId,
    });

    if (name === undefined || name === null) {
      return NextResponse.json(
        { error: "Repository name is required" },
        { status: 400 }
      );
    }

    if (typeof name !== "string") {
      return NextResponse.json(
        { error: "Repository name must be a non-empty string" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return NextResponse.json(
        { error: "Repository name must be a non-empty string" },
        { status: 400 }
      );
    }

    if (trimmedName.length > 100) {
      return NextResponse.json(
        { error: "Repository name must be 100 characters or less" },
        { status: 400 }
      );
    }

    if (url === undefined || url === null) {
      return NextResponse.json(
        { error: "Repository URL is required" },
        { status: 400 }
      );
    }

    if (typeof url !== "string") {
      return NextResponse.json(
        { error: "Repository URL must be a non-empty string" },
        { status: 400 }
      );
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      return NextResponse.json(
        { error: "Repository URL must be a non-empty string" },
        { status: 400 }
      );
    }

    if (trimmedUrl.length > 2000) {
      return NextResponse.json(
        { error: "Repository URL must be 2000 characters or less" },
        { status: 400 }
      );
    }

    try {
      const parsedUrl = new URL(trimmedUrl);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return NextResponse.json(
          { error: "Repository URL must use HTTP or HTTPS protocol" },
          { status: 400 }
        );
      }
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid repository URL format" },
        { status: 400 }
      );
    }

    let trimmedDescription: string | undefined = undefined;
    if (description !== undefined && description !== null) {
      if (typeof description !== "string") {
        return NextResponse.json(
          { error: "Repository description must be a string" },
          { status: 400 }
        );
      }
      trimmedDescription = description.trim();
      if (trimmedDescription.length > 1000) {
        return NextResponse.json(
          { error: "Repository description must be 1000 characters or less" },
          { status: 400 }
        );
      }
    }

    const repository = await repositoryService.createRepository({
      name: trimmedName,
      url: trimmedUrl,
      description: trimmedDescription || undefined,
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
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = request.nextUrl;

    const rawLimit = parseInt(searchParams.get("limit") ?? "10", 10);
    const limit = Math.min(isNaN(rawLimit) || rawLimit < 1 ? 10 : rawLimit, 50);
    const rawCursor = searchParams.get("cursor");

// Validate cursor — must be a positive integer string
if (rawCursor !== null && !/^\d+$/.test(rawCursor)) {
  return NextResponse.json(
    { error: "Invalid cursor format" },
    { status: 400 }
  );
}

const cursor = rawCursor ?? undefined;

    const rows = await getRepositories({
      userId: user.userId,
      limit: limit + 1,
      cursor,
    });

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? String(data[data.length - 1].id) : null;

    return NextResponse.json({ data, nextCursor, hasMore });
  } catch (error: any) {
    console.error("List repositories error:", error instanceof Error ? error.message : "Unknown error");
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}