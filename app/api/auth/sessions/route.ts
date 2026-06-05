import { NextRequest, NextResponse } from "next/server";
import { getAuthUser , sanitizeError } from "@/lib/middleware";
import prisma from "@/lib/prisma";
import { toJsonSafe } from "@/lib/utils/jsonSafe";
import { SAFE_SESSION_SELECT } from "@/lib/utils/sessionResponse";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: user.userId },
      data: { tokenVersion: { increment: 1 }, passwordChangedAt: new Date() },
    });

    const response = NextResponse.json({
      message: "All sessions terminated successfully",
    });

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");

    return response;
  } catch (error: any) {
    console.error("Delete sessions error:", sanitizeError(error));
    return NextResponse.json(
      { error: "Failed to terminate sessions" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const cursor = searchParams.get("cursor");

    // Default limit 10, max 50
    let limit = 10;
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = Math.min(parsedLimit, 50);
      }
    }

    // Fetch one extra item to determine if there is a next page
    const sessions = await prisma.session.findMany({
      where: { userId: user.userId },
      select: SAFE_SESSION_SELECT,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { expires: "desc" },
    });

    let nextCursor: string | undefined = undefined;
    if (sessions.length > limit) {
      sessions.pop(); // Remove the extra item
      nextCursor = sessions[sessions.length - 1]?.id;
    }

    return NextResponse.json({
      items: toJsonSafe(sessions),
      nextCursor,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
      },
    });
  } catch (error: any) {
    console.error("Fetch sessions error:", sanitizeError(error));
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
