import { NextRequest, NextResponse } from "next/server";
<<<<<<< standardize-api-errors
import { getAuthUser } from "@/lib/middleware";
import { apiError } from "@/lib/api-error";
=======
import { getAuthUser, sanitizeError } from "@/lib/middleware";

/**
 * Handles logout requests by validating the authorization header
 * and ensuring the user token is valid.
 */
>>>>>>> main
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

<<<<<<< standardize-api-errors
 if (!user) {
  return apiError(401, "Not authenticated");
}
=======
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization header is required" },
        { status: 400 }
      );
    }

    const parts = authHeader.split(" ");

    if (
      parts.length !== 2 ||
      parts[0] !== "Bearer" ||
      parts[1].trim() === ""
    ) {
      return NextResponse.json(
        {
          error:
            "Malformed Authorization header, expected 'Bearer <token>'",
        },
        { status: 400 }
      );
    }

    const user = await getAuthUser(request);
>>>>>>> main

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired authentication token" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", sanitizeError(error));

    return NextResponse.json(
      { error: "Failed to process logout request" },
      { status: 500 }
    );
  }
}