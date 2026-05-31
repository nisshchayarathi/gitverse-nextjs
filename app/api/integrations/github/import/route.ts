import { NextRequest, NextResponse } from "next/server";
import { requireAuth, sanitizeError } from "@/lib/middleware";
import { GitHubService, GitHubRateLimitError } from "@/lib/services/githubService";
import { repositoryService } from "@/lib/services/repositoryService";
import { analysisJobService } from "@/lib/services/analysisJobService";
import { triggerAnalysisWorkerWorkflow } from "@/lib/services/analysisWorkerTriggerService";
import { logger } from "@/lib/logger";
import { getEphemeralSecret } from "@/lib/utils/analysisRunner";

function kickLocalRunner(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return;
  const origin = new URL(request.url).origin;
  const secret = process.env.ANALYSIS_RUNNER_SECRET || getEphemeralSecret();
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
    logger.error(
      { err: sanitizeError(error) },
      "Failed to dispatch analysis worker workflow",
    );
  });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { url, token } = body;

    if (!url) {
      return NextResponse.json(
        { error: "Repository URL is required" },
        { status: 400 }
      );
    }

    if (!token) {
      return NextResponse.json(
        { error: "GitHub token is required" },
        { status: 400 }
      );
    }

    const parsed = GitHubService.parseGitHubUrl(url);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid GitHub URL" },
        { status: 400 }
      );
    }

    const github = new GitHubService(token);
    const repoData = await github.getRepository(parsed.owner, parsed.repo);

    const repository = await repositoryService.createRepository({
      name: repoData.name,
      url: repoData.clone_url,
      description: repoData.description || undefined,
      userId: user.userId,
    });

    const job = await analysisJobService.createRepositoryAnalysisJob({
      repositoryId: repository.id,
      userId: user.userId,
      scope: undefined,
    });

    kickLocalRunner(request);
    kickProductionWorker();

    return NextResponse.json({ repository, jobId: job.id, jobStatus: job.status, source: "github" }, { status: 201 });
  } catch (error: any) {
    console.error("GitHub import error:", sanitizeError(error));

    if (error instanceof GitHubRateLimitError) {
      return NextResponse.json(
        { error: error.message, retryAfter: error.retryAfterSeconds },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to import from GitHub" },
      { status: 500 }
    );
  }
}
