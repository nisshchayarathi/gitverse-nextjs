import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { GitHubAppService } from "@/lib/services/githubAppService";
import { GitHubService } from "@/lib/services/githubService";
import { verifySignedState } from "@/lib/utils/signedState";

type InstallState = { userId: number; ts: number; nonce?: string };

function getPublicOrigin(request: NextRequest): string {
  const forwardedProtoRaw = request.headers.get("x-forwarded-proto") || "";
  const forwardedHostRaw = request.headers.get("x-forwarded-host") || "";
  const hostRaw = request.headers.get("host") || "";

  const proto = (forwardedProtoRaw.split(",")[0] || "").trim();
  const host = (forwardedHostRaw.split(",")[0] || "").trim() || hostRaw;

  if (proto && host) return `${proto}://${host}`;

  // Fallback: Next's computed origin.
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const installationIdRaw = url.searchParams.get("installation_id");
  const setupAction = (url.searchParams.get("setup_action") || "").trim();
  const state = (url.searchParams.get("state") || "").trim();

  // Cloud Run may expose multiple *.run.app hostnames for the same service.
  // Our UI stores auth in localStorage, so switching origins loses the token.
  // Prefer a single canonical origin for post-install redirect.
  const canonicalOrigin = (process.env.NEXTAUTH_URL || "").trim();
  const redirectUrl = new URL(
    "/contribute",
    canonicalOrigin || getPublicOrigin(request),
  );

  if (!installationIdRaw || !Number.isFinite(Number(installationIdRaw))) {
    redirectUrl.searchParams.set("install", "error");
    redirectUrl.searchParams.set("reason", "missing_installation_id");
    return NextResponse.redirect(redirectUrl);
  }

  const installationId = Number(installationIdRaw);

  const verified = verifySignedState<InstallState>(state);
  if (!verified.ok) {
    redirectUrl.searchParams.set("install", "error");
    redirectUrl.searchParams.set("reason", verified.error);
    return NextResponse.redirect(redirectUrl);
  }

  const payload = verified.payload;
  const userId = Number(payload.userId);
  const ts = Number(payload.ts);
  if (!Number.isFinite(userId) || !Number.isFinite(ts)) {
    redirectUrl.searchParams.set("install", "error");
    redirectUrl.searchParams.set("reason", "bad_payload");
    return NextResponse.redirect(redirectUrl);
  }

  // 15 minute max age
  if (Date.now() - ts > 15 * 60 * 1000) {
    redirectUrl.searchParams.set("install", "error");
    redirectUrl.searchParams.set("reason", "expired_state");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const app = new GitHubAppService();
    const installationToken =
      await app.getInstallationAccessToken(installationId);

    const github = new GitHubService(installationToken);

    // Fetch all repos for this installation (best-effort pagination).
    const all: { id: number; full_name: string }[] = [];
    for (let page = 1; page <= 10; page++) {
      const { repositories } = await github.listInstallationRepositories({
        per_page: 100,
        page,
      });
      if (!repositories.length) break;
      all.push(
        ...repositories.map((r) => ({ id: r.id, full_name: r.full_name })),
      );
      if (repositories.length < 100) break;
    }

    // IMPORTANT: avoid interactive transactions here.
    // Neon/low pool sizes can cause Prisma to time out acquiring a transaction connection (P2028).
    if (all.length > 0) {
      const rows = all.map((r) => ({
        userId,
        repoFullName: r.full_name,
        enabled: false,
        installationId: BigInt(installationId),
      }));

      // Insert new rows (ignore duplicates on (userId, repoFullName)).
      await prisma.gitHubRepo.createMany({
        data: rows,
        skipDuplicates: true,
      });

      // Update installationId for any existing rows for these repos.
      // Batch to keep query sizes reasonable.
      const chunkSize = 200;
      for (let i = 0; i < all.length; i += chunkSize) {
        const chunk = all.slice(i, i + chunkSize).map((r) => r.full_name);
        await prisma.gitHubRepo.updateMany({
          where: {
            userId,
            repoFullName: { in: chunk },
          },
          data: {
            installationId: BigInt(installationId),
          },
        });
      }
    }

    redirectUrl.searchParams.set("install", "ok");
    redirectUrl.searchParams.set("setup_action", setupAction || "");
    redirectUrl.searchParams.set("installation_id", String(installationId));
    return NextResponse.redirect(redirectUrl);
  } catch (e: any) {
    console.error("GitHub App callback error:", e);
    redirectUrl.searchParams.set("install", "error");
    redirectUrl.searchParams.set("reason", e?.message || "unknown");
    return NextResponse.redirect(redirectUrl);
  }
}
