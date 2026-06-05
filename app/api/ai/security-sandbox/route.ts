import { NextRequest, NextResponse } from "next/server";
import { requireAuth, sanitizeError, isHttpError } from "@/lib/middleware";
import { runSecuritySandbox, getSandboxStatus, listSandboxesForRepository } from "@/lib/services/securitySandboxService";
import { isValidGitSha } from "@/lib/utils/validators";
import prisma from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/middleware/rateLimit";

const SANDBOX_RATE_LIMIT = 3;
const SANDBOX_WINDOW_MS = 60_000;

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const globalRl = await checkRateLimit(String(user.userId), RATE_LIMITS.AI_GLOBAL);
    if (!globalRl.allowed) return rateLimitResponse(globalRl);

    const allowed = await checkRateLimit(String(user.userId), { namespace: "security-sandbox", maxRequests: SANDBOX_RATE_LIMIT, windowMs: SANDBOX_WINDOW_MS });
    if (!allowed.allowed) return rateLimitResponse(allowed);
    const body = await request.json();
    const { repositoryId, pullRequestId, headSha } = body;

    if (!repositoryId || !headSha) {
      return NextResponse.json(
        { error: "repositoryId and headSha are required" },
        { status: 400 }
      );
    }

    if (!isValidGitSha(headSha)) {
      return NextResponse.json(
        { error: "Invalid headSha format. Must be a valid 40-character SHA-1 or 64-character SHA-256 hash." },
        { status: 400 }
      );
    }

    // Verify repository ownership
    const repository = await prisma.repository.findFirst({
      where: { id: Number(repositoryId), userId: user.userId },
      select: { id: true, url: true, name: true },
    });

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    const result = await runSecuritySandbox({
      repositoryId: repository.id,
      pullRequestId: pullRequestId ? Number(pullRequestId) : undefined,
      headSha,
      repositoryUrl: repository.url,
    });

    return NextResponse.json({ result }, { status: 200 });
  } catch (error: any) {
    console.error("Security sandbox error:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to run security sandbox" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const sandboxId = searchParams.get("sandboxId");
    const repositoryId = searchParams.get("repositoryId");

    if (sandboxId) {
      const sandbox = await getSandboxStatus(sandboxId);
      if (!sandbox) {
        return NextResponse.json(
          { error: "Sandbox not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ sandbox }, { status: 200 });
    }

    if (repositoryId) {
      // Verify repository ownership
      const repository = await prisma.repository.findFirst({
        where: { id: Number(repositoryId), userId: user.userId },
        select: { id: true },
      });

      if (!repository) {
        return NextResponse.json(
          { error: "Repository not found" },
          { status: 404 }
        );
      }

      const sandboxes = await listSandboxesForRepository(repository.id);
      return NextResponse.json({ sandboxes }, { status: 200 });
    }

    return NextResponse.json(
      { error: "sandboxId or repositoryId is required" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Security sandbox query error:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to query security sandbox" },
      { status: 500 }
    );
  }
}
