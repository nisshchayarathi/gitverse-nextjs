import { normalizeKnownRepoHttpUrl, normalizeTargetDirectory } from "@/lib/utils/repositoryUtils";import { NextRequest, NextResponse } from "next/server";
import { isValidGitScope } from "@/lib/utils/validators";
import { isHttpError, requireAuth, sanitizeError, getPrismaErrorResponse } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";
import { analysisJobService } from "@/lib/services/analysisJobService";
import { validateRepoUrl } from "@/utils/repoUrlValidator";
import { triggerAnalysisWorkerWorkflow } from "@/lib/services/analysisWorkerTriggerService";
import { GitService } from "@/lib/services/gitService";
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
    logger.error({ err: sanitizeError(error) }, "Failed to dispatch analysis worker workflow");
  });
}

function normalizeGitHubRepoUrl(input: string): string | null {
  const trimmed = input.trim();

  const patterns = [
    /^https:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?\/?$/i,
    /^http:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?\/?$/i,
    /^git@github\.com:([^/\s]+)\/([^/\s#?]+?)(?:\.git)?$/i,
    /^ssh:\/\/git@github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?$/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);

    if (match) {
      const owner = match[1];
      const repo = match[2];

      return `https://github.com/${owner}/${repo}`;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { name, url, description, targetDirectory } = body;

    if (!name || !url) {
      return NextResponse.json(
        { error: "Name and URL are required" },
        { status: 400 }
      );
    }

    // Validate URL format using the enhanced validator
    const validation = validateRepoUrl(url);
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: validation.error || "Invalid repository URL",
          suggestion: validation.suggestion
        },
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

    // Backend check to catch non-existent or private GitHub repositories
    const exists = await GitService.checkGithubRepositoryExists(normalizedUrl);
    if (!exists) {
      return NextResponse.json(
        {
          error: "NOT_FOUND",
          message: "Repository not found. Please ensure the URL is correct and the repository is public.",
        },
        { status: 404 }
      );
    }

    const normalizedTargetDirectory = normalizeTargetDirectory(targetDirectory);
    if (targetDirectory && !normalizedTargetDirectory) {
      return NextResponse.json(
        { error: "Invalid targetDirectory. Example: packages/ui or apps/web" },
        { status: 400 }
      );
    }

    // Use the normalized URL
    const normalizedUrl = validation.parsed!.normalizedUrl;

    const repository = await repositoryService.createRepository({
      name,
      url: normalizedUrl,
      description,
      targetDirectory: normalizedTargetDirectory ?? undefined,
      userId: user.userId,
    });

    console.log("Repository created:", repository.id);

    const rawScope = body.scope;
    if (rawScope != null && (typeof rawScope !== "string" || !isValidGitScope(rawScope))) {
      return NextResponse.json(
        { error: "Invalid scope. Only alphanumeric characters, underscore, dot, slash, and hyphen are allowed." },
        { status: 400 },
      );
    }
    let trimmedScope: string | undefined = undefined;
    if (rawScope && typeof rawScope === "string") {
      trimmedScope = rawScope.trim();
    }
    const job = await analysisJobService.createRepositoryAnalysisJob({
      repositoryId: repository.id,
      userId: user.userId,
      scope: trimmedScope || undefined,
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

    const stack = process.env.NODE_ENV === 'development' ? error.stack : error.stack?.split('\n').slice(0, 3).join('\n');
    logger.error({ err: sanitizeError(error), stack }, "Create repository error");
    const prismaError = getPrismaErrorResponse(error);
    if (prismaError) {
      return prismaError;
    }

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
    
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const cursorParam = searchParams.get("cursor");

    const limit = limitParam ? parseInt(limitParam, 10) : 10;
    const cursor = cursorParam ? parseInt(cursorParam, 10) : undefined;

    const result = await repositoryService.listRepositories(user.userId, limit, cursor);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("List repositories error:", error);

    logger.error({ err: sanitizeError(error) }, "List repositories error");
    const prismaError = getPrismaErrorResponse(error);
    if (prismaError) {
      return prismaError;
    }

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