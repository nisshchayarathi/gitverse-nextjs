import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";
import { analysisJobService } from "@/lib/services/analysisJobService";
import { triggerAnalysisWorkerWorkflow } from "@/lib/services/analysisWorkerTriggerService";

function normalizeKnownRepoHttpUrl(input: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  const supportedHosts = new Set(["github.com", "gitlab.com", "bitbucket.org"]);
  if (!supportedHosts.has(host)) return input;

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, "");
  if (!owner || !repo) return null;

  return `${parsed.protocol}//${parsed.host}/${owner}/${repo}`;
}

function kickLocalRunner(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return;
  const origin = new URL(request.url).origin;
  const secret = process.env.ANALYSIS_RUNNER_SECRET;
  void fetch(`${origin}/api/internal/run-analysis`, {
    method: "POST",
    headers: secret ? { "x-analysis-runner-secret": secret } : undefined,
  }).catch(() => {
    // Best-effort only.
  });
}

function kickProductionWorker() {
  if (process.env.NODE_ENV !== "production") return;

  void triggerAnalysisWorkerWorkflow().catch((error) => {
    console.error("Failed to dispatch analysis worker workflow:", error);
  });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { name, url, description } = body;

    console.log("Create repository request:", {
      name,
      url,
      userId: user.userId,
    });

    if (!name || !url) {
      return NextResponse.json(
        { error: "Name and URL are required" },
        { status: 400 }
      );
    }

    const normalizedUrl = normalizeKnownRepoHttpUrl(url);
    if (!normalizedUrl) {
      return NextResponse.json(
        {
          error:
            "Invalid repository URL. Use a full repository URL like https://github.com/owner/repo",
        },
        { status: 400 },
      );
    }

    const repository = await repositoryService.createRepository({
      name,
      url: normalizedUrl,
      description,
      userId: user.userId,
    });

    console.log("Repository created:", repository.id);

    const job = await analysisJobService.createRepositoryAnalysisJob({
      repositoryId: repository.id,
      userId: user.userId,
    });

    kickLocalRunner(request);
    kickProductionWorker();

    return NextResponse.json(
      { repository, jobId: job.id, jobStatus: job.status },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create repository error:", error);
    console.error("Error stack:", error.stack);
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Failed to create repository" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const repositories = await repositoryService.listRepositories(user.userId);

    return NextResponse.json({ repositories }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
      },
    });
  } catch (error: any) {
    console.error("List repositories error:", error);
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Failed to list repositories" },
      { status: 500 }
    );
  }
}
