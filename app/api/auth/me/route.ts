import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser, sanitizeError } from "@/lib/middleware";
import { getAuthUser } from "@/lib/middleware";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
          },
        },
      );
      return apiError(401, "Not authenticated");
    }

    // Fetch user details
    const userDetails = await prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!userDetails) {
      return NextResponse.json(
        { error: "User not found" },
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
          },
        },
      );
     return apiError(404, "User not found");
    }

    return NextResponse.json(
      {
        user: {
          id: userDetails.id,
          email: userDetails.email,
          name: userDetails.name,
          avatarUrl: (userDetails as any).image,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
        },
      },
    );
  } catch (error) {
    console.error("Get user error:", sanitizeError(error));
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
    console.error("Get user error:", error);
    return apiError(500, "Internal server error");
  }
}
