import { NextRequest } from "next/server";
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
