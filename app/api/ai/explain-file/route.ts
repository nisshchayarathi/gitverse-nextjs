import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth, sanitizeError } from "@/lib/middleware";
import { GeminiService } from "@/lib/services/geminiService";
import { GitHubService } from "@/lib/services/githubService";
import { getDecryptedGitHubToken } from "@/lib/utils/githubToken";
import prisma from "@/lib/prisma";
import axios from "axios";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { repoUrl, filePath, repositoryId } = body;

    if (!filePath) {
      return NextResponse.json(
        { error: "File path is required" },
        { status: 400 }
      );
    }

    // Try to get repoUrl if not provided
    let url = repoUrl;
    if (!url && repositoryId) {
      const repo = await prisma.repository.findFirst({
        where: { id: Number(repositoryId), userId: user.userId },
        select: { url: true }
      });
      url = repo?.url;
    }

    if (!url) {
      return NextResponse.json(
        { error: "Repository URL or ID is required" },
        { status: 400 }
      );
    }

    const ownerRepo = GitHubService.parseGitHubUrl(url);
    if (!ownerRepo) {
      return NextResponse.json(
        { error: "Invalid GitHub repository URL" },
        { status: 400 }
      );
    }
    const { owner, repo } = ownerRepo;

    // Fetch user's GitHub token if it exists
    const token = await getDecryptedGitHubToken(user.userId);

    let fileContent = "";
    
    // Attempt 1: Fetch via GitHub Contents API (works well for both public and private repos)
    try {
      const headers: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "GitVerse-App",
      };
      if (token) {
        headers["Authorization"] = `token ${token}`;
      }
      
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        { headers }
      );
      
      if (response.data && response.data.content) {
        const encoding = response.data.encoding;
        if (encoding === "base64") {
          fileContent = Buffer.from(response.data.content, "base64").toString("utf-8");
        } else {
          fileContent = response.data.content;
        }
      } else {
        throw new Error("No content field found in GitHub API response");
      }
    } catch (apiError: any) {
      console.warn("GitHub API file fetch failed, attempting raw fallback:", apiError.message);
      
      // Attempt 2: Fallback to raw githubusercontent (trying both main and master branches)
      let rawResponse;
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `token ${token}`;
      }

      try {
        rawResponse = await axios.get(
          `https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath}`,
          { headers, responseType: "text" }
        );
      } catch (rawMainError) {
        try {
          rawResponse = await axios.get(
            `https://raw.githubusercontent.com/${owner}/${repo}/master/${filePath}`,
            { headers, responseType: "text" }
          );
        } catch (rawMasterError: any) {
          return NextResponse.json(
            { error: `Failed to fetch file content from GitHub: ${rawMasterError.message}` },
            { status: 404 }
          );
        }
      }
      
      fileContent = rawResponse.data;
    }

    if (!fileContent && fileContent !== "") {
      return NextResponse.json(
        { error: "Fetched file content is empty or undefined" },
        { status: 400 }
      );
    }

    // Check approximate token size (approx. 4 characters per token)
    const charCount = fileContent.length;
    const approxTokens = Math.ceil(charCount / 4);
    
    // Set a safe limit, e.g., 30,000 tokens (approx 120,000 characters)
    const maxTokens = 30000;
    if (approxTokens > maxTokens) {
      return NextResponse.json(
        { error: `File is too large for AI explanation (${approxTokens} tokens). Please choose a file smaller than ${maxTokens} tokens.` },
        { status: 400 }
      );
    }

    // Initialize Gemini Service and explain file
    const gemini = new GeminiService();
    const prompt = `
You are an expert software developer. Explain the following file in 2-3 paragraphs.
Focus on its main purpose, key functionalities, and exports/methods it provides.
Be concise, clear, and professional. Output standard Markdown (e.g. bolding, lists, inline code blocks) to organize the information.

File Path: ${filePath}
File Content:
\`\`\`
${fileContent}
\`\`\`
`;
    
    const explanation = await gemini.chatRaw(prompt);

    return NextResponse.json({
      explanation,
      file: { path: filePath, language: filePath.split(".").pop() || "unknown" },
    });
  } catch (error: any) {
    console.error("File explanation error:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to explain file" },
      { status: 500 }
    );
  }
}
