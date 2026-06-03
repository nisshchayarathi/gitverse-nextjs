import {
  normalizeKnownRepoHttpUrl,
  normalizeTargetDirectory,
} from "@/lib/utils/repositoryUtils";
import { validateSafeUrl } from "@/lib/utils/ssrfValidator";
import { NextRequest, NextResponse } from "next/server";
import { countAttempts, recordAttempt } from "@/lib/services/rateLimitService";
import {
  isHttpError,
  requireAuth,
  sanitizeError,
  getPrismaErrorResponse,
} from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";
import { analysisJobService } from "@/lib/services/analysisJobService";
import { getGithubAccessToken } from "@/lib/services/githubAuthService";
import { triggerAnalysisWorkerWorkflow } from "@/lib/services/analysisWorkerTriggerService";
import { GitService } from "@/lib/services/gitService";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess } from "@/lib/utils/apiResponse";
import { isValidGitScope } from "@/lib/utils/validators";
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
      { err: sanitizeError(error) },
      "Failed to dispatch analysis worker workflow",
    );
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

    const attemptsCount = await countAttempts(
      String(user.userId),
      "REPOSITORY_ANALYSIS",
      24 * 60 * 60 * 1000
    );

    if (attemptsCount >= 5) {
      return apiError("Analysis rate limit exceeded. Please try again later.", 429);
    }

    const body = await request.json();
    const { name, url, description, targetDirectory } = body;

    if (!name || !url) {
      return apiError("Name and URL are required", 400);
    }

    const normalizedUrl = normalizeKnownRepoHttpUrl(url);
    if (!normalizedUrl) {
      return apiError(
        "Invalid repository URL. Use a full repository URL like https://github.com/owner/repo",
        400,
      );
    }

    const isSafe = await validateSafeUrl(normalizedUrl);
    if (!isSafe) {
      return apiError(
        "Invalid repository URL. The URL resolves to an untrusted or private network address.",
        400,
      );
    }

    // Backend check to catch non-existent or private repositories
    let exists = false;
    
    // First try without token (public check)
    exists = await GitService.checkGithubRepositoryExists(normalizedUrl);
    
    if (!exists) {
      // Try with user's github token (private check)
      const token = await getGithubAccessToken(user.userId);
      if (token) {
        exists = await GitService.checkGithubRepositoryExists(normalizedUrl, token);
      }
    }

    if (!exists) {
      return NextResponse.json(
        { error: "GitHub repository not found or not accessible. If it is private, please sign in with GitHub." },
        { status: 404 }
      );
    }

    const normalizedTargetDirectory = normalizeTargetDirectory(targetDirectory);
    if (targetDirectory && !normalizedTargetDirectory) {
      return apiError(
        "Invalid targetDirectory. Example: packages/ui or apps/web",
        400,
      );
    }

    let trimmedScope: string | undefined = undefined;
    const rawScope = body.scope;
    if (rawScope != null) {
      if (typeof rawScope !== "string") {
        return NextResponse.json(
          {
            error:
              "Invalid scope. Only alphanumeric characters, underscore, dot, slash, and hyphen are allowed.",
          },
          { status: 400 },
        );
      }

      const normalizedScope = rawScope.trim();
      if (normalizedScope) {
        if (!isValidGitScope(normalizedScope)) {
          return NextResponse.json(
            {
              error:
                "Invalid scope. Only alphanumeric characters, underscore, dot, slash, and hyphen are allowed.",
            },
            { status: 400 },
          );
        }
        trimmedScope = normalizedScope;
      }
    }

    const repository = await repositoryService.createRepository({
      name,
      url: normalizedUrl,
      description,
      targetDirectory: normalizedTargetDirectory ?? undefined,
      userId: user.userId,
      isPrivate,
    });

    logger.info({ repositoryId: repository.id }, "Repository created");

    const job = await analysisJobService.createRepositoryAnalysisJob({
      repositoryId: repository.id,
      userId: user.userId,
      scope: trimmedScope || undefined,
    });

    kickLocalRunner(request);
    kickProductionWorker();

    await recordAttempt({
      key: String(user.userId),
      type: "REPOSITORY_ANALYSIS",
      success: true,
      userId: user.userId,
    });

    return apiSuccess(
      {
        repository,
        jobId: job.id,
        jobStatus: job.status,
      },
      201,
    );
  } catch (error: any) {
    const stack =
      process.env.NODE_ENV === "development"
        ? error.stack
        : error.stack?.split("\n").slice(0, 3).join("\n");
    logger.error(
      { err: sanitizeError(error), stack },
      "Create repository error",
    );
    if (isHttpError(error)) {
      return apiError(error.message, error.status);
    }
    return apiError("Failed to create repository", 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const cursorParam = searchParams.get("cursor");

    const result = await repositoryService.listRepositories(
      user.userId,
      limitParam ? parseInt(limitParam) : 10,
      cursorParam ? parseInt(cursorParam) : undefined,
    );

    return apiSuccess({
      repositories: result.data,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    });
  } catch (error: any) {
    console.error("List repositories error:", error);

    logger.error({ err: sanitizeError(error) }, "List repositories error");
    const prismaError = getPrismaErrorResponse(error);
    if (prismaError) {
      return prismaError;
    }

    if (isHttpError(error)) {
      return apiError(error.message, error.status);
    }
    return apiError("Failed to list repositories", 500);
  }
}
