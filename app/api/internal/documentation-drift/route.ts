import { NextRequest, NextResponse } from "next/server";
import { DocumentationDriftService } from "@/lib/services/documentation-drift";
import prisma from "@/lib/prisma";
import crypto from "crypto";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max for Vercel

function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function GET(request: NextRequest) {
  return handleDriftDetection(request);
}

export async function POST(request: NextRequest) {
  return handleDriftDetection(request);
}

async function handleDriftDetection(request: NextRequest) {
  // 1. Authenticate Request - only accept secret via header (not query param)
  // to prevent credential leakage in access logs and browser history.
  const headerSecret = request.headers.get("x-analysis-runner-secret");
  const configuredSecret = process.env.ANALYSIS_RUNNER_SECRET;

  if (configuredSecret) {
    if (!headerSecret || !timingSafeCompare(headerSecret, configuredSecret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized - ANALYSIS_RUNNER_SECRET not configured" }, { status: 401 });
    }
  }

  // 2. Select an active repository to scan
  // For simplicity, we just select one enabled repo that hasn't been scanned for drift recently.
  // In a real app, we might add a lastDriftScanAt field to GitHubRepo or Repository.
  // We'll just randomly select one or pick the most recently active.
  const repoToScan = await prisma.gitHubRepo.findFirst({
    where: {
      enabled: true,
      installationId: { not: null },
    },
    orderBy: {
      updatedAt: "asc" // Poor man's round-robin
    },
    include: {
      user: true
    }
  });

  if (!repoToScan || !repoToScan.installationId) {
    return NextResponse.json({ ok: true, message: "No eligible repositories found for drift detection." });
  }

  // We need the internal Repository record to query its files
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
    
    // Update the repository so it goes to the end of the line for the next run
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
