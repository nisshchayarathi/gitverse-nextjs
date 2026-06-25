import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth, sanitizeError } from "@/lib/middleware";
import prisma from "@/lib/prisma";
import { fetchGitHubFileContent } from "@/lib/services/githubService";
import { extractTechStack } from "@/lib/utils/techStackParser";

const securityHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const idStr = params.id;
    if (!idStr || !/^\d+$/.test(idStr)) {
      return NextResponse.json(
        { error: "Invalid repository ID" },
        { status: 400, headers: securityHeaders }
      );
    }
    const id = parseInt(idStr, 10);

    const repository = await prisma.repository.findFirst({
      where: { id, userId: user.userId },
      select: { url: true },
    });

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404, headers: securityHeaders }
      );
    }

    const isGitHub = repository.url.includes("github.com");
    const isGitLab = repository.url.includes("gitlab.com");
    const isBitbucket = repository.url.includes("bitbucket.org");

    if (isGitLab || isBitbucket) {
      const provider = isGitLab ? "GitLab" : "Bitbucket";
      return NextResponse.json(
        {
          error: "Unsupported provider",
          code: "unsupported-provider",
          message: `${provider} is not currently supported for tech stack analysis because manifest fetch helpers do not exist for this provider.`,
        },
        { status: 400, headers: securityHeaders }
      );
    }

    if (!isGitHub) {
      return NextResponse.json(
        {
          error: "Unsupported provider",
          code: "unsupported-provider",
          message: "Only GitHub repositories are supported for tech stack analysis.",
        },
        { status: 400, headers: securityHeaders }
      );
    }

    let techStack: string[] = [];
    try {
      const packageJsonContent = await fetchGitHubFileContent(
        repository.url,
        "package.json",
        user.userId
      );

      if (packageJsonContent) {
        const packageJson = JSON.parse(packageJsonContent);
        techStack = extractTechStack(packageJson);
      }
    } catch (err) {
      console.warn("Failed to fetch or parse package.json for repository:", id, err);
    }

    return NextResponse.json({ techStack }, { headers: securityHeaders });
  } catch (error: any) {
    console.error("Error fetching repository tech stack:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: securityHeaders }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch repository tech stack" },
      { status: 500, headers: securityHeaders }
    );
  }
}
