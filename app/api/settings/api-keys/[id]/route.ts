import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/middleware/api-auth";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateRequest(req);
  if (!auth.user) return auth.error;

  const keyId = Number(params.id);
  if (!Number.isFinite(keyId)) {
    return NextResponse.json({ error: "Invalid key ID" }, { status: 400 });
  }

  const apiKey = await prisma.apiKey.findUnique({ where: { id: keyId } });
  if (!apiKey || apiKey.userId !== auth.user.id) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  await prisma.apiKey.delete({ where: { id: keyId } });

  return NextResponse.json({ ok: true });
}
