import { NextRequest, NextResponse } from "next/server";
import { DocumentationDriftService } from "@/lib/services/documentation-drift";
import { isAnalysisRunnerTokenValid } from "@/lib/utils/internalAuth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  return handleDriftDetection(request);
}

export async function POST(request: NextRequest) {
  return handleDriftDetection(request);
}

async function handleDriftDetection(request: NextRequest) {
  if (!process.env.ANALYSIS_RUNNER_SECRET) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Unauthorized - ANALYSIS_RUNNER_SECRET not configured" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Unauthorized - ANALYSIS_RUNNER_SECRET not configured" },
      { status: 401 }
    );
  }

  const headerSecret = request.headers.get("x-analysis-runner-secret");
  if (!isAnalysisRunnerTokenValid(headerSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repoToScan = await prisma.gitHubRepo.findFirst({
    where: {
      enabled: true,
      installationId: { not: null },
    },
    orderBy: {
      updatedAt: "asc"
    },
    include: {
      user: true
    }
  });

  if (!repoToScan || !repoToScan.installationId) {
    return NextResponse.json({ ok: true, message: "No eligible repositories found for drift detection." });
  }

  const internalRepo = await prisma.repository.findFirst({
    where: {
      url: {
        contains: repoToScan.repoFullName
      }
    }
  });

  if (!internalRepo) {
    return NextResponse.json({ ok: true, message: "Repository not fully indexed yet." });
  }

  const [owner, repoName] = repoToScan.repoFullName.split("/");

  const context = {
    owner,
    repo: repoName,
    installationId: repoToScan.installationId,
    repositoryId: internalRepo.id,
  };

  try {
    const driftService = new DocumentationDriftService();
    const result = await driftService.runDriftDetection(context);

    await prisma.gitHubRepo.update({
      where: { id: repoToScan.id },
      data: { updatedAt: new Date() }
    });

    console.log(`[DocumentationDriftJob] Completed for ${repoToScan.repoFullName}: Analyzed ${result.filesAnalyzed} files, found ${result.driftedFiles} drifting files.`);
    if (result.prUrl) {
      console.log(`[DocumentationDriftJob] Created PR: ${result.prUrl}`);
    }

    return NextResponse.json({
      ok: true,
      repository: repoToScan.repoFullName,
      ...result
    });

  } catch (error: any) {
    console.error("[DocumentationDriftJob] Failed:", error);
    return NextResponse.json({ error: error.message || "Failed to run drift detection" }, { status: 500 });
  }
}
