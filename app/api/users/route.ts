import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isHttpError } from "@/lib/middleware";
import {
  parsePaginationParams,
  buildPaginatedResponse,
} from "@/lib/utils/pagination";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/users
 *
 * Returns a paginated list of users using cursor-based pagination.
 *
 * Query parameters:
 *   - `limit`  (optional) — Items per page, 1–100 (default 20).
 *   - `cursor` (optional) — The `id` of the last item from the previous page.
 *
 * Response: `PaginatedResponse<UserSummary>`
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const { limit, cursor } = parsePaginationParams(
      request.nextUrl.searchParams,
    );

    const users = await prisma.user.findMany({
      take: limit + 1,
      ...(cursor !== null ? { where: { id: { gt: cursor } } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
      },
    });

    return NextResponse.json(buildPaginatedResponse(users, limit));
  } catch (error: unknown) {
    if (isHttpError(error)) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }

    console.error("Error listing users:", error);
    return NextResponse.json(
      { message: "Failed to list users" },
      { status: 500 },
    );
  }
}
