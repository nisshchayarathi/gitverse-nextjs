import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isHttpError, requireAuth } from "@/lib/middleware";
import { sanitizeErrorMessage } from "@/lib/utils/rateLimit";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/users
 *
 * Returns a cursor-paginated list of users.
 *
 * Query params:
 *   limit  – number of records to return (default: 20, max: 100)
 *   cursor – opaque cursor (user id from the previous page's nextCursor)
 *
 * Response:
 *   { data: User[], nextCursor: string | null }
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication — any signed-in user may list users.
    await requireAuth(request);

    const { searchParams } = new URL(request.url);

    // --- validate limit ---
    const rawLimit = searchParams.get("limit");
    let limit = DEFAULT_LIMIT;

    if (rawLimit !== null) {
      const parsed = Number(rawLimit);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return NextResponse.json(
          { error: "limit must be a positive integer" },
          { status: 400 }
        );
      }
      if (parsed > MAX_LIMIT) {
        return NextResponse.json(
          { error: `limit must not exceed ${MAX_LIMIT}` },
          { status: 400 }
        );
      }
      limit = parsed;
    }

    // --- validate cursor ---
    const rawCursor = searchParams.get("cursor");
    let cursorId: number | undefined;

    if (rawCursor !== null) {
      const parsed = Number(rawCursor);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return NextResponse.json(
          { error: "cursor is invalid" },
          { status: 400 }
        );
      }
      cursorId = parsed;
    }

    // --- Prisma cursor pagination ---
    // Fetch one extra record to determine whether a next page exists.
    const rows = await prisma.user.findMany({
      take: limit + 1,
      ...(cursorId !== undefined
        ? { cursor: { id: cursorId }, skip: 1 }
        : {}),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
      },
    });

    const hasNextPage = rows.length > limit;
    const data = hasNextPage ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasNextPage ? String(data[data.length - 1].id) : null;

    return NextResponse.json({ data, nextCursor });
  } catch (error: unknown) {
    console.error("List users error:", sanitizeErrorMessage(error));
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
