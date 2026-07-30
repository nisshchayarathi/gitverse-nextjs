import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth, sanitizeError } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";
import { analysisJobService } from "@/lib/services/analysisJobService";
import prisma from "@/lib/prisma";
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const id = parseInt(params.id);

    const rl = await checkRateLimit(String(user.userId), RATE_LIMITS.REPOSITORY_ANALYZE);
    if (!rl.allowed) return rateLimitResponse(rl);

    if (isNaN(id)) {
      return apiError(400, "Invalid repository ID");
    }

    const repository = await repositoryService.getRepository(id, user.userId);

    if (!repository) {
      return apiError(404, "Repository not found");
    }
    const maxConcurrentJobs = Number(
  process.env.MAX_CONCURRENT_ANALYSIS_PER_USER || 3
);

const activeJobsCount = await prisma.analysisJob.count({
  where: {
    userId: user.userId,
    status: {
      in: ["QUEUED", "PROCESSING"],
    },
  },
});

if (activeJobsCount >= maxConcurrentJobs) {
  return NextResponse.json(
    {
      error:
        "Too many sync/analyze jobs running. Please wait before retrying.",
      retryAfter: 60,
    },
    { status: 429 }
  );
}

    const { scope } = await request.json();

    if (scope != null && (typeof scope !== "string" || !isValidGitScope(scope))) {
      return apiError(400, "Invalid scope. Only alphanumeric characters, underscore, dot, slash, and hyphen are allowed.");
    }

    const job = await analysisJobService.createRepositoryAnalysisJob({
      repositoryId: id,
      userId: user.userId,
      scope,
    });

    // Invalidate cached stats — repo status is now "analyzing" / queued.
    ttlCache.deleteByPrefix(`repo-stats:${id}:`);

    return NextResponse.json(
      { message: "Job queued", jobId: job.id, status: job.status },
      { status: 202 }
    );
  } catch (error: any) {
    console.error("Analyze repository error:", sanitizeError(error));
    if (isHttpError(error)) {
      return apiError(error.status, error.message);
    }
    return apiError(500, "Failed to start analysis");
  }
}
