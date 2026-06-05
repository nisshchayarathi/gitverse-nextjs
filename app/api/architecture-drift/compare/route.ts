import { NextRequest } from "next/server";
import { generateDriftReport, listSnapshots } from "@/lib/services/architectureDriftService";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const repoId = Number(url.searchParams.get("repositoryId"));
    const baseline = url.searchParams.get("baselineId");
    const compared = url.searchParams.get("comparedId");
    if (!repoId) return new Response(JSON.stringify({ ok: false, error: "repositoryId required" }), { status: 400 });

    // If baseline/compared not provided, use latest two snapshots
    const snaps = await listSnapshots(repoId, 2);
    if (!baseline || !compared) {
      if (snaps.length < 2) return new Response(JSON.stringify({ ok: false, error: "Not enough snapshots" }), { status: 400 });
      const baseId = snaps[1].id;
      const compId = snaps[0].id;
      const { rec, report } = await generateDriftReport(repoId, baseId, compId);
      return new Response(JSON.stringify({ ok: true, rec, report }), { headers: { "Content-Type": "application/json" } });
    }

    const { rec, report } = await generateDriftReport(repoId, Number(baseline), Number(compared));
    return new Response(JSON.stringify({ ok: true, rec, report }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
}
