import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { verifyToken } from "./auth";

export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export async function requireAuth(
  request: NextRequest
): Promise<{ userId: number }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new HttpError("Authentication required", 401);
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    throw new HttpError("Invalid or expired token", 401);
  }

  return { userId: payload.userId };
}

export async function getAuthUser(
  request: NextRequest
): Promise<{ userId: number } | null> {
  try {
    return await requireAuth(request);
  } catch {
    return null;
  }
}
import { verifyToken, JWTPayload } from "./auth";

export interface AuthenticatedRequest {
  user: JWTPayload;
}

export async function getAuthUser(
  request: NextRequest
): Promise<JWTPayload | null> {
  try {
    const authHeader = request.headers.get("authorization");

    // 1) Existing JWT auth (Authorization: Bearer ...)
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      if (token) {
        const payload = verifyToken(token);
        if (payload && typeof payload.userId === "number" && payload.userId > 0) {
          return payload;
        }
      }
    }

    // 2) NextAuth session cookie (Google OAuth)
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    
    if (!token?.sub || !token.email) return null;

    const userId = Number(token.sub);
    if (!Number.isFinite(userId) || userId <= 0) return null;

    return { userId, email: token.email };
  } catch (error) {
    // Safely return null on any error without logging sensitive information
    return null;
  }
}

export async function requireAuth(request: NextRequest): Promise<JWTPayload> {
  const user = await getAuthUser(request);

  if (!user || !user.userId) {
    throw new HttpError(401, "Unauthorized");
  }

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

export function badRequestResponse(message = "Bad request") {
  return new NextResponse(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

export function unauthorizedResponse(message = "Authentication required") {
  return new NextResponse(JSON.stringify({ error: message }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export function forbiddenResponse(message = "You do not have access to this resource") {
  return new NextResponse(JSON.stringify({ error: message }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

export function notFoundResponse(message = "Resource not found") {
  return new NextResponse(JSON.stringify({ error: message }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

export function isHttpError(error: any): error is { status: number; message: string } {
  return typeof error === "object" && error !== null && "status" in error && "message" in error;
}

export async function getAuthUser(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !token.sub) return null;
  return { userId: parseInt(token.sub, 10) };
}

export async function requireAuth(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || !user.userId) throw { status: 401, message: "Authentication required" };
  return user;
}
export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export async function requireAuth(
  request: NextRequest
): Promise<{ userId: number }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new HttpError("Authentication required", 401);
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    throw new HttpError("Invalid or expired token", 401);
  }

  return { userId: payload.userId };
}

export async function getAuthUser(
  request: NextRequest
): Promise<{ userId: number } | null> {
  try {
    return await requireAuth(request);
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest {
  user: JWTPayload;
}

export async function getAuthUser(
  request: NextRequest
): Promise<JWTPayload | null> {
  try {
    const authHeader = request.headers.get("authorization");

    // 1) Existing JWT auth (Authorization: Bearer ...)
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      if (token) {
        const payload = verifyToken(token);
        if (payload && typeof payload.userId === "number" && payload.userId > 0) {
          return payload;
        }
      }
    }

    // 2) NextAuth session cookie (Google OAuth)
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    
    if (!token?.sub || !token.email) return null;

    const userId = Number(token.sub);
    if (!Number.isFinite(userId) || userId <= 0) return null;

    return { userId, email: token.email };
  } catch (error) {
    // Safely return null on any error without logging sensitive information
    return null;
  }
}

export async function requireAuth(request: NextRequest): Promise<JWTPayload> {
  const user = await getAuthUser(request);

  if (!user || !user.userId) {
    throw new HttpError(401, "Unauthorized");
  }

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
  // We explicitly DO NOT include '/api/:path*' because API routes 
  // manage their own auth via requireAuth(), allowing webhooks and crons to work.
  matcher: ["/dashboard/:path*", "/profile/:path*"],
};
