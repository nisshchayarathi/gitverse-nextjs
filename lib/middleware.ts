import { NextRequest, NextResponse } from "next/server";
import { verifyToken, JWTPayload } from "./auth";
import { getToken } from "next-auth/jwt";

export interface AuthenticatedRequest {
  user: JWTPayload;
}

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

  // Tighten authorization checks to prevent cross-user data access
  const resourceOwnerId = request.headers.get("x-resource-owner-id");
  if (resourceOwnerId && String(resourceOwnerId) !== String(user.userId)) {
    throw new HttpError(403, "Forbidden: You do not have access to this resource.");
  }

  return user;
}

export async function requireOwnership(
  request: NextRequest,
  resourceUserId: number
): Promise<JWTPayload> {
  const user = await requireAuth(request);
  if (user.userId !== resourceUserId) {
    throw new HttpError(403, "Forbidden");
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

export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  try {
    const str = String(error);
    return str.length > 200 ? str.substring(0, 200) + "..." : str;
  } catch {
    return "Unknown error";
  }
}

export function errorResponse(message: string, status: number = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
