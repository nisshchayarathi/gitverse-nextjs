import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/middleware/api-auth";
import { generateApiKey, generateKeyExpiry } from "@/lib/utils/api-key";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.user) return auth.error;

  const keys = await prisma.apiKey.findMany({
    where: { userId: auth.user.id },
    select: {
      id: true,
      name: true,
      scopes: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.user) return auth.error;

  let body: { name?: string; scopes?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { raw, hashed } = generateApiKey();
  const expiresAt = generateKeyExpiry(365);

  await prisma.apiKey.create({
    data: {
      userId: auth.user.id,
      name: body.name.trim(),
      hashedKey: hashed,
      scopes: body.scopes || [],
      expiresAt,
    },
  });

  return NextResponse.json(
    {
      key: raw,
      name: body.name.trim(),
      expiresAt: expiresAt.toISOString(),
      message: "Save this key now — it will not be shown again",
    },
    { status: 201 },
  );
}
