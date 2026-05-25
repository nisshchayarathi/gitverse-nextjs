import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth, sanitizeError } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";

const securityHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

const MAX_PATHS = 1000;

const parseRepositoryId = (id: string) => {
  const repositoryId = parseInt(id, 10);
  return Number.isNaN(repositoryId) ? null : repositoryId;
};

const parsePathsFromRequest = async (
  request: NextRequest,
): Promise<unknown[]> => {
  if (request.method === "GET") {
    const searchParams = request.nextUrl.searchParams;
    return [
      ...searchParams.getAll("path"),
      ...searchParams.getAll("paths").flatMap((value) => value.split(",")),
    ];
  }

  const body = await request.json().catch(() => ({}));
  return Array.isArray(body.paths) ? body.paths : [];
};

async function handleFileStats(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth(request);
    const repositoryId = parseRepositoryId(params.id);

    if (!repositoryId) {
      return NextResponse.json(
        { error: "Invalid repository ID" },
        { status: 400, headers: securityHeaders },
      );
    }

    const paths = (await parsePathsFromRequest(request)).filter(
      (path): path is string => typeof path === "string",
    );

    if (paths.length > MAX_PATHS) {
      return NextResponse.json(
        { error: `Too many paths requested (max ${MAX_PATHS})` },
        { status: 400, headers: securityHeaders },
      );
    }

    const stats = await repositoryService.getFileStats(
      repositoryId,
      user.userId,
      paths,
    );

    return NextResponse.json(
      { stats },
      { status: 200, headers: securityHeaders },
    );
  } catch (error: any) {
    console.error("Get file stats error:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: securityHeaders },
      );
    }

    if (error.message === "Repository not found") {
      return NextResponse.json(
        { error: error.message },
        { status: 404, headers: securityHeaders },
      );
    }

    return NextResponse.json(
      { error: "Failed to get file statistics" },
      { status: 500, headers: securityHeaders },
    );
  }
}

export const GET = handleFileStats;
export const POST = handleFileStats;
