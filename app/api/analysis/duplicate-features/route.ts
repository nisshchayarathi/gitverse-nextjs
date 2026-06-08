import { NextResponse } from "next/server";
import { analyzeRepository } from "@/lib/services/duplicateFeatureDetector";

export async function GET() {
  try {
    const root = process.cwd();
    const features = await analyzeRepository(root);
    return NextResponse.json({ ok: true, features });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
