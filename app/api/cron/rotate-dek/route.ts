import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { rotateDek } from "@/lib/utils/envelopeEncryption";

export const runtime = "nodejs";
export const maxDuration = 120;

function timingSafeBearerMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on this server" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;

  if (!timingSafeBearerMatch(authHeader, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await rotateDek();

    return NextResponse.json({
      success: true,
      message: "DEK rotated successfully. Update WRAPPED_DEK in all environments.",
      wrappedDekPrefix: result.newWrapped.substring(0, 16) + "...",
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: `DEK rotation failed: ${e.message}` },
      { status: 500 },
    );
  }
}
