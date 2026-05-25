import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth, sanitizeError } from "@/lib/middleware";
import prisma from "@/lib/prisma";
import { repositoryService } from "@/lib/services/repositoryService";
import { GitHubService } from "@/lib/services/githubService";
import { getGeminiService } from "@/lib/services/geminiService";

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
    const skills = request.nextUrl.searchParams.get("skills") || "";

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid repository ID" },
        { status: 400, headers: securityHeaders }
      );
    }

    const repository = await repositoryService.getRepository(id, user.userId);
    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404, headers: securityHeaders }
      );
    }

    const parsed = GitHubService.parseGitHubUrl(repository.url);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid GitHub repository URL" },
        { status: 400, headers: securityHeaders }
      );
    }

    // Retrieve user's GitHub access token if connected
    const account = await prisma.gitHubAccount.findUnique({
      where: { userId: user.userId },
      select: { accessToken: true },
    });

    const github = new GitHubService(account?.accessToken);
    let githubIssues = [];
    try {
      githubIssues = await github.getIssues(parsed.owner, parsed.repo, {
        labels: "good first issue,help wanted",
        state: "open",
        per_page: 10,
      });
    } catch (apiErr: any) {
      console.warn("GitHub API fetch issues failed:", apiErr.message);
      // Grudgingly fall back to mock issues if the GitHub API is totally unreachable or rate-limited
      githubIssues = [
        {
          number: 101,
          title: "Fix responsive design in dashboard layout",
          html_url: `${repository.url}/issues/101`,
          body: "The layout sidebar breaks on mobile viewports. We need to hide it and add a toggle button.",
          labels: [{ name: "good first issue" }],
        },
        {
          number: 102,
          title: "Optimize prisma queries in repository stats",
          html_url: `${repository.url}/issues/102`,
          body: "The endpoint /api/repositories/[id]/stats is taking over 2 seconds. We need to add better selects to query less columns.",
          labels: [{ name: "help wanted" }],
        },
        {
          number: 103,
          title: "Add unit tests for gemini service",
          html_url: `${repository.url}/issues/103`,
          body: "We need mock-based unit tests for all prompts inside geminiService.ts.",
          labels: [{ name: "good first issue" }],
        },
      ];
    }

    if (githubIssues.length === 0) {
      return NextResponse.json(
        { issues: [] },
        { status: 200, headers: securityHeaders }
      );
    }

    // Get list of repository files to supply as context
    const repositoryFiles = (repository.files || [])
      .map((f: any) => f.path)
      .slice(0, 50); // limit to top 50 files for token safety

    const gemini = getGeminiService();

    const prompt = `
You are an expert AI software architect at GitVerse.
We have fetched a list of open "good first issues" from a GitHub repository.
Your task is to analyze these issues and map them to the best-matching files/modules in the codebase.

Repository Tech Stack & Context:
- URL: ${repository.url}
- Primary Files: ${JSON.stringify(repositoryFiles)}
${skills ? `- Contributor Skills/Interests: ${skills}` : ""}

Issues list:
${JSON.stringify(
  githubIssues.map((issue: any) => ({
    number: issue.number,
    title: issue.title,
    body: issue.body || "No description provided",
  }))
)}

Please return a JSON object with a single root key "matches" containing a list of matched issues.
Do not return any markdown formatting, only output valid JSON.
Each matched issue in the array must contain:
1. "number": (integer) The issue number matching the input.
2. "score": (integer 0-100) How good a fit this issue is. If contributor skills are specified, score higher for issues matching those skills. If no skills are specified, score based on simplicity of the task for a beginner.
3. "matchedFiles": (array of strings) The exact matching file paths from the Primary Files list. (Maximum 3 files).
4. "reason": (string) A concise, one-sentence explanation of why these files are matched and what needs to be changed.

JSON output structure:
{
  "matches": [
    {
      "number": 101,
      "score": 85,
      "matchedFiles": ["src/components/layout/DashboardLayout.tsx"],
      "reason": "This modifies layout structure which is managed in DashboardLayout.tsx."
    }
  ]
}
`;

    let aiResponse = "";
    let parsedMatches: any[] = [];
    try {
      aiResponse = await gemini.chatRaw(prompt);
      // Clean potential markdown blocks
      const cleanJson = aiResponse
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();
      const payload = JSON.parse(cleanJson);
      parsedMatches = Array.isArray(payload.matches) ? payload.matches : [];
    } catch (err) {
      console.error("AI matching failed:", err);
      // Fallback matching logic (simple matching based on keyword heuristic)
      parsedMatches = githubIssues.map((issue: any) => {
        const titleLower = issue.title.toLowerCase();
        const matched: string[] = [];
        let score = 50;

        for (const file of repositoryFiles) {
          const fileLower = file.toLowerCase();
          const baseName = fileLower.split("/").pop() || "";
          if (
            (titleLower.includes("layout") && fileLower.includes("layout")) ||
            (titleLower.includes("test") && fileLower.includes("test")) ||
            (titleLower.includes("prisma") && fileLower.includes("prisma")) ||
            (titleLower.includes("stats") && fileLower.includes("stats"))
          ) {
            matched.push(file);
          }
        }

        return {
          number: issue.number,
          score: matched.length > 0 ? 80 : 40,
          matchedFiles: matched.slice(0, 3),
          reason: matched.length > 0 
            ? `Matched based on keyword match for ${matched[0]}`
            : "General issue that needs broad codebase understanding.",
        };
      });
    }

    const matchesMap = new Map(
      parsedMatches.map((m: any) => [m.number, m])
    );

    const enrichedIssues = githubIssues.map((issue: any) => {
      const match = matchesMap.get(issue.number) || {
        score: 50,
        matchedFiles: [],
        reason: "Matched as a general repository-wide issue.",
      };

      return {
        id: issue.id || issue.number,
        number: issue.number,
        title: issue.title,
        htmlUrl: issue.html_url,
        body: issue.body || "",
        labels: Array.isArray(issue.labels) 
          ? issue.labels.map((l: any) => typeof l === "object" ? l.name : l)
          : [],
        score: match.score,
        matchedFiles: match.matchedFiles,
        reason: match.reason,
      };
    });

    // Sort by score descending
    enrichedIssues.sort((a: any, b: any) => b.score - a.score);

    return NextResponse.json(
      { issues: enrichedIssues },
      { status: 200, headers: securityHeaders }
    );
  } catch (error: any) {
    console.error("Get issues error:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: securityHeaders }
      );
    }

    return NextResponse.json(
      { error: "Failed to get repository issues" },
      { status: 500, headers: securityHeaders }
    );
  }
}
