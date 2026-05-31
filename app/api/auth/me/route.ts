import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAuthFailureResponse } from "@/lib/auth-response";
import {
  getAuthUserDetails,
  sanitizeError,
} from "@/lib/middleware";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { user, bearerTokenError } = await getAuthUserDetails(request);

    if (!user) {
      const response = createAuthFailureResponse(
        "Not authenticated",
        bearerTokenError
      );

      response.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, private"
      );

      return response;
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
  }
}
