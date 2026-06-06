import { NextRequest, NextResponse } from "next/server";
import { rotateDek } from "@/lib/utils/envelopeEncryption";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await rotateDek();
    console.log("[RotateDEK] Key rotated successfully");

    return NextResponse.json({
      success: true,
      message: "DEK rotated successfully. Update WRAPPED_DEK in all environments.",
      wrappedDekPrefix: result.newWrapped.substring(0, 16) + "...",
    });
  } catch (e: any) {
    console.error("[RotateDEK] Rotation failed:", e.message);
    return NextResponse.json(
      { error: `DEK rotation failed: ${e.message}` },
      { status: 500 },
    );
  }
}
