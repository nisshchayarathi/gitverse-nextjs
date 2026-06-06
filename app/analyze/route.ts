import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { repositoryService } from "@/lib/services/repositoryService";
import { analysisJobService } from "@/lib/services/analysisJobService";
import { sanitizeError } from "@/lib/middleware";
import { triggerAnalysisWorkerWorkflow } from "@/lib/services/analysisWorkerTriggerService";
import { normalizeTargetDirectory } from "@/lib/utils/repositoryUtils";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/middleware/rateLimit";

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
  if (!secret) return;
  void fetch(`${origin}/api/internal/run-analysis`, {
    method: "POST",
    headers: { "x-analysis-runner-secret": secret },
  }).catch(() => {
    // Best-effort only.
  });
}

function kickProductionWorker() {
  if (process.env.NODE_ENV !== "production") return;

  void triggerAnalysisWorkerWorkflow().catch((error) => {
    logger.error(
      { err: sanitizeError(error), operation: "dispatch-analysis-worker-workflow" },
      "Failed to dispatch analysis worker workflow"
    );
  });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const rl = await checkRateLimit(String(user.userId), RATE_LIMITS.ANALYZE_REPOSITORY);
    if (!rl.allowed) return rateLimitResponse(rl);
    const body = await request.json();

    const repositoryIdRaw = body?.repositoryId;
    const url = body?.url;
    const name = body?.name;
    const description = body?.description;
    const targetDirectory = body?.targetDirectory;

    let repositoryId: number;

    if (repositoryIdRaw != null) {
      repositoryId = Number(repositoryIdRaw);
      if (!Number.isFinite(repositoryId)) {
        return NextResponse.json(
          { error: "Invalid repositoryId" },
          { status: 400 }
        );
      }

      const repo = await prisma.repository.findFirst({
        where: { id: repositoryId, userId: user.userId },
        select: { id: true },
      });

      if (!repo) {
        return NextResponse.json(
          { error: "Repository not found" },
          { status: 404 }
        );
      }
    } else {
      if (!url || !name) {
        return NextResponse.json(
          { error: "Provide either repositoryId or (name + url)" },
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

      const normalizedTargetDirectory = normalizeTargetDirectory(targetDirectory);
      if (targetDirectory && !normalizedTargetDirectory) {
        return NextResponse.json(
          { error: "Invalid targetDirectory. Example: packages/ui or apps/web" },
          { status: 400 }
        );
      }

      const repo = await repositoryService.createRepository({
        name,
        url: normalizedUrl,
        description,
        targetDirectory: normalizedTargetDirectory ?? undefined,
        userId: user.userId,
      });

      repositoryId = repo.id;
    }

    const job = await analysisJobService.createRepositoryAnalysisJob({
      repositoryId,
      userId: user.userId,
    });

    kickLocalRunner(request);
    kickProductionWorker();

    return NextResponse.json(
      { jobId: job.id, status: job.status, repositoryId },
      { status: 202 }
    );
  } catch (error: any) {
    logger.error(
      { err: sanitizeError(error), operation: "POST /analyze" },
      "POST /analyze error"
    );
    return NextResponse.json(
      { error: "Failed to create job" },
      { status: 500 }
    );
  }
}
