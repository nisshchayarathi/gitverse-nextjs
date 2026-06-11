import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { analysisJobService } from "@/lib/services/analysisJobService";
import { apiError } from "@/lib/api-error";

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const user = await requireAuth(request);
    const jobId = params.jobId;

    if (!jobId) {
      return apiError(400, "Missing jobId");
    }

    const job = await analysisJobService.getJob({
      jobId,
      userId: user.userId,
    });

    if (!job) {
      return apiError(404, "Job not found");
    }

    // Check export format
    const format = request.nextUrl.searchParams.get("format");

    // Markdown export for Issue #68
    if (format === "markdown") {
      const markdown = `
# Repository Analysis Report

## Summary

Repository analysis for job ${jobId}

## Key Findings

- Status: ${job.status}
- Progress: ${job.progressPercent ?? 0}%

## Recommendations

- Review high-complexity files.
- Focus on active contributors.
- Address critical issues first.
`;

      return new NextResponse(markdown, {
        headers: {
          "Content-Type": "text/markdown",
          "Content-Disposition": `attachment; filename="analysis-${jobId}.md"`,
        },
      });
    }

    // Default JSON response (Issue #67)
    return NextResponse.json({
      schemaVersion: "1.0.0",
      job,
    });
  } catch (error: any) {
    console.error("GET /analysis/:jobId error:", error);

    return apiError(
      500,
      error?.message || "Failed to fetch job"
    );
  }
}