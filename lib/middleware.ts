import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { verifyToken, JWTPayload } from "./auth";

export interface AuthenticatedRequest {
  user: JWTPayload;
}

export async function middleware(request: NextRequest) {
  try {
    // Step 1: Get the logged-in user's session token
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    // Step 2: If no token, user is not logged in → redirect to login
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const userId = token.sub; // This is the logged-in user's ID

    // Step 3: Get the resource owner ID from the request headers (if provided)
    const resourceOwnerId = request.headers.get("x-resource-owner-id");

    // Step 4: If a resource owner is specified, check it matches the logged-in user
    if (resourceOwnerId && resourceOwnerId !== userId) {
      // Someone is trying to access another user's data → block them!
      return NextResponse.json(
        { error: "Forbidden: You do not have access to this resource." },
        { status: 403 }
      );
    }

    // Step 5: Everything checks out → allow the request to continue
    return NextResponse.next();

  } catch (error) {
    // Step 6: Something went wrong on the server → return 500 error
    console.error("Middleware error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// This tells Next.js WHICH pages/routes to protect
export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*", "/profile/:path*"],
};

export async function getAuthUser(
  request: NextRequest
): Promise<JWTPayload | null> {
  const authHeader = request.headers.get("authorization");

  // 1) Existing JWT auth (Authorization: Bearer ...)
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (payload) return payload;
  }

  // 2) NextAuth session cookie (Google OAuth)
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (!token?.sub || !token.email) return null;

    const userId = Number(token.sub);
    if (!Number.isFinite(userId)) return null;

    return { userId, email: token.email };
  } catch {
    return null;
  }
}

export async function requireAuth(request: NextRequest): Promise<JWTPayload> {
  const user = await getAuthUser(request);

  if (!user) {
    throw new HttpError(401, "Unauthorized");
  }

  return user;
}

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as any).status === "number"
  );
}