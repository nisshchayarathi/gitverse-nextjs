import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth, sanitizeError } from "@/lib/middleware";
import { getGeminiService } from "@/lib/services/geminiService";
import { repositoryService } from "@/lib/services/repositoryService";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const { repositoryId, diff } = body;

    if (!diff || typeof diff !== "string" || !diff.trim()) {
      return NextResponse.json(
        { error: "Diff content is required" },
        { status: 400 }
      );
    }

    let repoContext = "";
    if (repositoryId) {
      const repoId = Number(repositoryId);
      if (!isNaN(repoId)) {
        const repository = await repositoryService.getRepository(repoId, user.userId);
        if (repository) {
          const langText = repository.languages
            .map((l: any) => `${l.name} (${l.percentage}%)`)
            .join(", ");
          repoContext = `
Repository: "${repository.name}"
Description: ${repository.description || "N/A"}
Tech Stack/Languages: ${langText || "N/A"}
`;
        }
      }
    }

    const prompt = `You are a senior principal software engineer and automated code reviewer.
You are reviewing a simulated Pull Request by analyzing the following raw git diff output:

${repoContext ? `===== REPOSITORY CONTEXT =====\n${repoContext}\n` : ""}
===== GIT DIFF FOR REVIEW =====
${diff.substring(0, 15000)}
===============================

Please perform a comprehensive code review. Provide your review structured in clean Markdown with the following sections:

1. **Simulated Code Review Summary**: High-level overview of what the changes are doing and their overall quality.
2. **Potential Bugs & Logical Inconsistencies**: Highlight any issues, edge cases, regression risks, or logical errors found in the changes. If none, state that.
3. **Security Vulnerabilities**: Identify any security risks, credentials leaks, SQL injection, XSS, or other vulnerabilities in the modified/added lines.
4. **Styling, Quality & Performance Suggestions**: Recommend syntax refinements, readability improvements, performance boosts, or styling guidelines.
5. **Automated GitHub PR Summary**: Generate a ready-to-copy automated GitHub pull request description. Include:
   - A short, descriptive **PR Title** (conventional commit style, e.g. feat(auth): add login endpoint)
   - A concise **Description** of the changes and a list of key modifications.

Ensure the feedback is highly professional, constructive, and grounded strictly in the diff provided. If there are no issues in a category, explicitly state that the code looks clean.`;

    const gemini = getGeminiService();
    const simulatedReview = await gemini.chatRaw(prompt);

    return NextResponse.json({ review: simulatedReview });
  } catch (error: any) {
    console.error("PR Simulator AI error:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate simulated PR review" },
      { status: 500 }
    );
  }
}
