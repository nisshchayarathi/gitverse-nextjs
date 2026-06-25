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
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid repository ID" },
        { status: 400, headers: securityHeaders }
      );
    }

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
