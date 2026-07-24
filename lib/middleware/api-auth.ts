import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";
import { hashApiKey, extractBearerToken } from "@/lib/utils/api-key";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
}

export interface AuthResult {
  user: AuthUser | null;
  error: NextResponse | null;
  scopes: string[];
}

async function resolveSessionUser(req: NextRequest): Promise<AuthUser | null> {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (token?.sub) {
      const id = Number(token.sub);
      if (Number.isFinite(id)) {
        return { id, email: (token.email as string) || "", name: (token.name as string) || "" };
      }
    }
  } catch {
    // Session fetch failed
  }
  return null;
}

async function resolveApiKeyUser(req: NextRequest): Promise<{ user: AuthUser | null; scopes: string[] }> {
  const authHeader = req.headers.get("authorization");
  const rawKey = extractBearerToken(authHeader);
  if (!rawKey) return { user: null, scopes: [] };

  const hashed = hashApiKey(rawKey);
  try {
    const apiKey = await prisma.apiKey.findUnique({ where: { hashedKey: hashed } });
    if (!apiKey) return { user: null, scopes: [] };

    if (apiKey.expiresAt < new Date()) return { user: null, scopes: [] };

    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    const user = await prisma.user.findUnique({
      where: { id: apiKey.userId },
      select: { id: true, email: true, name: true },
    });

    const scopes = Array.isArray(apiKey.scopes) ? (apiKey.scopes as string[]) : [];

    return { user, scopes };
  } catch {
    return { user: null, scopes: [] };
  }
}

export async function authenticateRequest(req: NextRequest): Promise<AuthResult> {
  const apiKeyResult = await resolveApiKeyUser(req);
  if (apiKeyResult.user) return { user: apiKeyResult.user, error: null, scopes: apiKeyResult.scopes };

  const sessionUser = await resolveSessionUser(req);
  if (sessionUser) return { user: sessionUser, error: null, scopes: [] };

  return {
    user: null,
    error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    scopes: [],
  };
}

export function requireScopes(
  authResult: AuthResult,
  requiredScopes: string[],
): NextResponse | null {
  if (!authResult.user) return authResult.error;

  const hasAllRequired = requiredScopes.every(scope => authResult.scopes.includes(scope));

  if (!hasAllRequired) {
    return NextResponse.json(
      {
        error: "Insufficient scopes",
        required: requiredScopes,
        granted: authResult.scopes,
      },
      { status: 403 }
    );
  }

  return null;
}
