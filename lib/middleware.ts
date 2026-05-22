import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { verifyToken } from "@/lib/auth";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

export async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (payload) return payload;
  }

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

export async function requireAuth(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    throw new HttpError(401, "Unauthorized");
  }
  return user;
}

export function isHttpError(error: unknown): error is HttpError {
  if (error instanceof HttpError) {
    return true;
  }

  return (
    typeof error === "object" &&
    error !== null &&
    (error as Record<string, unknown>).name === "HttpError" &&
    "status" in error &&
    typeof (error as Record<string, unknown>).status === "number"
  );
}

export async function middleware(request: NextRequest) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const userId = token.sub; 

   
    const resourceOwnerId = request.headers.get("x-resource-owner-id");


    if (resourceOwnerId && resourceOwnerId !== userId) {
 
      return NextResponse.json(
        { error: "Forbidden: You do not have access to this resource." },
        { status: 403 }
      );
    }

    return NextResponse.next();

  } catch (error) {

    console.error("Middleware error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*", "/profile/:path*"],
};