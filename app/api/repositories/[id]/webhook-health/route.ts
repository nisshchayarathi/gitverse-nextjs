import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sanitizeError, isHttpError } from "@/lib/middleware";
import { enforceRepositoryPermission } from "@/middleware/repository-permissions";

const securityHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

function parseRepoFullNameFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname.replace(/^\//, "").replace(/\/$/, "");
    const parts = pathname.split("/");
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
    return null;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const repositoryId = Number(params.id);
    if (isNaN(repositoryId)) {
      return NextResponse.json({ error: "Invalid repository ID" }, { status: 400, headers: securityHeaders });
    }

    const permission = await enforceRepositoryPermission(request, repositoryId, 'settings_read');
    if (!permission.allowed && permission.errorResponse) {
      return permission.errorResponse;
    }

    const repository = await prisma.repository.findUnique({
      where: { id: repositoryId },
      select: { id: true, name: true, url: true },
    });

    if (!repository) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404, headers: securityHeaders });
    }

    const repoFullName = parseRepoFullNameFromUrl(repository.url);
    if (!repoFullName) {
      return NextResponse.json({ error: "Invalid repository URL" }, { status: 400, headers: securityHeaders });
    }

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const periodRanges = [
      { label: "24h", since: dayAgo },
      { label: "7d", since: weekAgo },
      { label: "30d", since: monthAgo },
    ];

    const webhookEvents = await prisma.webhookEvent.findMany({
      where: {
        payload: { path: ["repository", "full_name"], equals: repoFullName },
        createdAt: { gte: monthAgo },
      },
      select: {
        id: true,
        status: true,
        event: true,
        error: true,
        createdAt: true,
        updatedAt: true,
        nextRetryAt: true,
        deliveryId: true,
        retryCount: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const periods = periodRanges.map(({ label, since }) => {
      const filtered = webhookEvents.filter((e) => e.createdAt >= since);
      const total = filtered.length;
      const success = filtered.filter((e) => e.status === "completed").length;
      return {
        period: label,
        totalDeliveries: total,
        successRate: total > 0 ? Math.round((success / total) * 10000) / 10000 : 0,
        successCount: success,
        failedCount: filtered.filter((e) => e.status === "failed" || e.status === "dlq").length,
        processingCount: filtered.filter((e) => e.status === "processing").length,
      };
    });

    const failedEvents = webhookEvents
      .filter((e) => e.status === "failed" || e.status === "dlq" || e.status === "rate_limited")
      .slice(0, 20);

    const recentErrors = failedEvents.map((e) => ({
      id: e.id,
      event: e.event,
      error: e.error,
      createdAt: e.createdAt.toISOString(),
      deliveryId: e.deliveryId,
      retryCount: e.retryCount,
      nextRetryAt: e.nextRetryAt?.toISOString() || null,
    }));

    const statusCounts = {
      pending: webhookEvents.filter((e) => e.status === "pending").length,
      processing: webhookEvents.filter((e) => e.status === "processing").length,
      completed: webhookEvents.filter((e) => e.status === "completed").length,
      failed: webhookEvents.filter((e) => e.status === "failed").length,
      dlq: webhookEvents.filter((e) => e.status === "dlq").length,
      rate_limited: webhookEvents.filter((e) => e.status === "rate_limited").length,
    };

    const overallTotal = webhookEvents.length;
    const overallSuccess = webhookEvents.filter((e) => e.status === "completed").length;
    const healthScore = overallTotal > 0
      ? Math.round((overallSuccess / overallTotal) * 100)
      : 100;

    return NextResponse.json({
      repoFullName,
      healthScore,
      periods,
      statusCounts,
      recentErrors,
      totalDeliveries: overallTotal,
      successRate: overallTotal > 0 ? Math.round((overallSuccess / overallTotal) * 10000) / 10000 : 0,
    }, { headers: securityHeaders });
  } catch (error: any) {
    if (isHttpError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: securityHeaders });
    }
    console.error("Webhook health fetch error:", sanitizeError(error));
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: securityHeaders });
  }
}
