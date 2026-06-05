import { analyzeRepository } from "@/lib/services/knowledgeGapDetector";
import path from "path";

export async function GET() {
  try {
    const repoRoot = path.resolve(process.cwd());
    const results = await analyzeRepository(repoRoot);
    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
}
