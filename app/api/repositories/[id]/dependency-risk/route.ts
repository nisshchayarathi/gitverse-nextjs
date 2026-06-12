import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sanitizeError, isHttpError } from "@/lib/middleware";
import { enforceRepositoryPermission } from "@/middleware/repository-permissions";
import { DependencyRiskScoreService, PackageDependency } from "@/lib/services/dependency-risk-score";

const securityHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

function parseRepoFullNameFromUrl(url: string): { owner: string; repo: string } | null {
  try {
    const pathname = new URL(url).pathname.replace(/^\//, "").replace(/\/$/, "");
    const parts = pathname.split("/");
    if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
    return null;
  } catch {
    return null;
  }
}

async function fetchLockFile(
  owner: string,
  repo: string,
  fileName: string,
  branch: string = "main",
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${fileName}`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (response.ok) return await response.text();
  } catch {
    // fallback
  }

  try {
    const response = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/master/${fileName}`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (response.ok) return await response.text();
  } catch {
    // not found
  }

  return null;
}

function parsePackageJson(content: string): PackageDependency[] {
  const deps: PackageDependency[] = [];
  try {
    const json = JSON.parse(content);
    if (json.dependencies) {
      for (const [name, version] of Object.entries(json.dependencies)) {
        deps.push({ name, version: version as string, scope: "production" });
      }
    }
    if (json.devDependencies) {
      for (const [name, version] of Object.entries(json.devDependencies)) {
        deps.push({ name, version: version as string, scope: "development" });
      }
    }
  } catch {
    // invalid JSON
  }
  return deps;
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

    const permission = await enforceRepositoryPermission(request, repositoryId, "settings_read");
    if (!permission.allowed && permission.errorResponse) {
      return permission.errorResponse;
    }

    const repository = await prisma.repository.findUnique({
      where: { id: repositoryId },
      select: { id: true, name: true, url: true, defaultBranch: true },
    });

    if (!repository) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404, headers: securityHeaders });
    }

    const repoInfo = parseRepoFullNameFromUrl(repository.url);
    if (!repoInfo) {
      return NextResponse.json({ error: "Invalid repository URL" }, { status: 400, headers: securityHeaders });
    }

    const branch = repository.defaultBranch || "main";

    const lockFiles = ["package.json", "package-lock.json"];
    let dependencies: PackageDependency[] = [];

    for (const fileName of lockFiles) {
      const content = await fetchLockFile(repoInfo.owner, repoInfo.repo, fileName, branch);
      if (content) {
        dependencies = parsePackageJson(content);
        if (dependencies.length > 0) break;
      }
    }

    const service = new DependencyRiskScoreService();
    const report = await service.computeRiskScore(dependencies);

    return NextResponse.json({
      repository: {
        id: repository.id,
        name: repository.name,
        fullName: `${repoInfo.owner}/${repoInfo.repo}`,
        lockFilesFound: dependencies.length > 0 ? ["package.json"] : [],
      },
      ...report,
    }, { headers: securityHeaders });
  } catch (error: any) {
    if (isHttpError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: securityHeaders });
    }
    console.error("Dependency risk fetch error:", sanitizeError(error));
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: securityHeaders });
  }
}
