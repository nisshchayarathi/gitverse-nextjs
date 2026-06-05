import { NextRequest } from "next/server";
import { getRecentlyActiveAreas } from "@/lib/services/recentlyActiveAreasService";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const repositoryId = Number(url.searchParams.get("repositoryId"));
    if (!repositoryId) {
      return new Response(JSON.stringify({ ok: false, error: "repositoryId required" }), { status: 400 });
    }

    const areas = await getRecentlyActiveAreas(repositoryId, 10);
    return new Response(JSON.stringify({ ok: true, areas }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
}
