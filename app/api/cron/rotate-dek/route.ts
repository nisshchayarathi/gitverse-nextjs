import { NextRequest, NextResponse } from "next/server";
import { rotateAndReEncryptAll } from "@/lib/utils/envelopeEncryption";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await rotateAndReEncryptAll();
    console.log("[RotateDEK] Key rotated and credentials re-encrypted successfully");

    return NextResponse.json({
      success: true,
      message: "DEK rotated and credentials re-encrypted successfully.",
      githubAccountsCount: result.githubAccountsCount,
      accountsCount: result.accountsCount,
      mfaConfigsCount: result.mfaConfigsCount,
      durationMs: result.durationMs,
      newWrappedPrefix: result.newWrapped.substring(0, 16) + "...",
    });
  } catch (e: any) {
    console.error("[RotateDEK] Rotation and re-encryption failed:", e.message);
    return NextResponse.json(
      { error: `DEK rotation and re-encryption failed: ${e.message}` },
      { status: 500 },
    );
  }
}
