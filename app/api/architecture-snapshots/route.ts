import { NextRequest } from "next/server";
import { saveSnapshot } from "@/lib/services/architectureDriftService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repositoryId, snapshot } = body;
    if (!repositoryId || !snapshot) {
      return new Response(JSON.stringify({ ok: false, error: "repositoryId and snapshot required" }), { status: 400 });
    }
    const rec = await saveSnapshot(Number(repositoryId), snapshot);
    return new Response(JSON.stringify({ ok: true, snapshotId: rec.id }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
}
