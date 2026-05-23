import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorizedResponse } from "@/lib/middleware";

export async function POST(request: NextRequest) {
  try {
    // Guard: reject non-JSON content-type if body is provided
    const contentType = request.headers.get("content-type");
    if (contentType && !contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 400 }
      );
    }

    const user = await getAuthUser(request);
    if (!user) {
      return unauthorizedResponse("No active session to log out from");
    }

    // In a stateless JWT setup, logout is handled client-side by removing the token
    // We can optionally implement token blacklisting here if needed
    
    return NextResponse.json(
      { message: "Logged out successfully" },
      { status: 200 }
    );
  } catch (err) {
    console.error("[logout] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// Reject wrong HTTP methods
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405, headers: { Allow: "POST" } }
  );
}