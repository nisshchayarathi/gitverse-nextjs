import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";
import { hashApiKey, extractBearerToken } from "@/lib/utils/api-key";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  scopes?: string[];
}

export type AuthResult =
  | { user: AuthUser; error: null }
  | { user: null; error: NextResponse };

async function resolveSessionUser(req: NextRequest): Promise<AuthUser | null> {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (token?.sub) {
      const id = Number(token.sub);
      if (Number.isFinite(id)) {
        return {
          id,
          email: (token.email as string) || "",
          name: (token.name as string) || "",
          scopes: [],
        };
      }
    }
  } catch {
    // Session fetch failed
  }
  return null;
}

async function resolveApiKeyUser(req: NextRequest): Promise<AuthUser | null> {
  const authHeader = req.headers.get("authorization");
  const rawKey = extractBearerToken(authHeader);
  if (!rawKey) return null;

  const hashed = hashApiKey(rawKey);
  try {
    const apiKey = await prisma.apiKey.findUnique({ where: { hashedKey: hashed } });
    if (!apiKey) return null;

    if (apiKey.expiresAt < new Date()) return null;

    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    const user = await prisma.user.findUnique({
      where: { id: apiKey.userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) return null;

    let scopes: string[] = [];
    if (apiKey.scopes && Array.isArray(apiKey.scopes)) {
      scopes = apiKey.scopes.map(String);
    }

    return {
      ...user,
      scopes,
    };
  } catch {
    return null;
  }
}

export async function authenticateRequest(req: NextRequest): Promise<AuthResult> {
  let user = await resolveApiKeyUser(req);
  if (user) return { user, error: null };

  user = await resolveSessionUser(req);
  if (user) return { user, error: null };

  return {
    user: null,
    error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  };
}

export function requireScopes(
  authResult: AuthResult,
  requiredScopes: string[],
): NextResponse | null {
  if (!authResult.user) return authResult.error;
  if (requiredScopes.length === 0) return null;

  const userScopes = new Set(authResult.user.scopes ?? []);
  const missing = requiredScopes.filter((s) => !userScopes.has(s));
  if (missing.length > 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}
