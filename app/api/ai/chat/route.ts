import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth, sanitizeError } from "@/lib/middleware";
import { getGeminiService } from "@/lib/services/geminiService";
import { repositoryService } from "@/lib/services/repositoryService";
import { checkAiRateLimit, logAiRequest } from "@/lib/utils/ipRateLimit";
import { getClientIp } from "@/lib/services/rateLimitService";
import { GitHubService } from "@/lib/services/githubService";
import prisma from "@/lib/prisma";
import axios from "axios";
import {
  validateContentType,
  AI_REQUEST_LIMITS,
} from "@/lib/utils/aiRequestValidation";

// Allowed roles in the conversation history
const ALLOWED_MESSAGE_ROLES = new Set(["user", "model", "assistant"]);

// Helper to fetch file content from GitHub
async function fetchGitHubFileContent(url: string, filePath: string, userId: number): Promise<string> {
  const ownerRepo = GitHubService.parseGitHubUrl(url);
  if (!ownerRepo) return "";
  const { owner, repo } = ownerRepo;

  const gitHubAccount = await prisma.gitHubAccount.findUnique({
    where: { userId },
    select: { accessToken: true },
  });
  const token = gitHubAccount?.accessToken;

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
        return Buffer.from(response.data.content, "base64").toString("utf-8");
      }
      return response.data.content;
    }
  } catch (error) {
    console.warn(`Failed to fetch file ${filePath} via API, trying raw fallback:`, error);
  }

  // Raw fallback
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `token ${token}`;
  }

  for (const branch of ["main", "master"]) {
    try {
      const response = await axios.get(
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`,
        { headers, responseType: "text" }
      );
      if (response.data) return response.data;
    } catch {
      // Continue to next branch
    }
  }

  return "";
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const contentTypeError = validateContentType(request);
    if (contentTypeError) return contentTypeError;

    const body = await request.json();
    const repositoryId = Number(body.repositoryId);
    const question = body.question || body.prompt;
    const conversationHistory = body.conversationHistory || body.messages;

    if (!repositoryId || !question) {
      return NextResponse.json(
        { error: "repositoryId and question/prompt are required" },
        { status: 400 }
      );
    }

    // Per-user rate limiting (DB-backed, shared across serverless containers)
    const allowed = await checkAiRateLimit(
      String(user.userId), "userId", "chat", 30, 60_000
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before sending another message." },
        { status: 429 }
      );
    }

    // Validate and standardize conversation history
    let standardizedHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
    if (conversationHistory !== undefined) {
      if (!Array.isArray(conversationHistory)) {
        return NextResponse.json(
          { error: "conversationHistory must be an array" },
          { status: 400 }
        );
      }
      for (const msg of conversationHistory) {
        if (
          !msg ||
          typeof msg !== "object" ||
          typeof msg.role !== "string" ||
          !ALLOWED_MESSAGE_ROLES.has(msg.role) ||
          typeof msg.content !== "string" ||
          !msg.content.trim()
        ) {
          return NextResponse.json(
            {
              error:
                "Each conversationHistory entry must have a valid role ('user', 'model', or 'assistant') and a non-empty content string",
            },
            { status: 400 }
          );
        }
        standardizedHistory.push({
          role: msg.role === "assistant" || msg.role === "model" ? "assistant" : "user",
          content: msg.content,
        });
      }
    }

    // Ownership check: getRepository returns null if the repository does not
    // belong to the requesting user, so unauthorized access returns 404.
    const repository = await repositoryService.getRepository(
      repositoryId,
      user.userId
    );

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    // RAG Pipeline: Identify and retrieve relevant files using user's question
    const files = (repository as any).files || [];
    let retrievedFilesContent = "";

    if (files.length > 0) {
      const filePaths = files.map((f: any) => f.path);
      const questionLower = question.toLowerCase();

      // Heuristic filtering: find files that mention keywords from the question to narrow candidates
      const keywords = questionLower
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter((w: string) => w.length > 3 && !["what", "how", "where", "why", "who", "show", "tell", "explain", "code", "file", "repo", "repository", "this", "that", "there", "with"].includes(w));

      let candidatePaths = filePaths;
      if (keywords.length > 0) {
        candidatePaths = filePaths.filter((path: string) => {
          const pathLower = path.toLowerCase();
          return keywords.some((kw: string) => pathLower.includes(kw));
        });
      }

      // Keep candidates within a reasonable list size (max 50)
      if (candidatePaths.length === 0) {
        candidatePaths = filePaths.slice(0, 50);
      } else {
        candidatePaths = candidatePaths.slice(0, 50);
      }

      try {
        const gemini = getGeminiService();
        const fileSelectionPrompt = `
You are a codebase indexing assistant. Given the following list of file paths in the repository "${repository.name}":
${candidatePaths.join("\n")}

And the user's question: "${question}"

Select up to 3 files that are most likely to contain the code, logic, or definitions required to answer the user's question.
Return ONLY a valid JSON array of strings containing the selected file paths, e.g. ["src/auth.ts", "prisma/schema.prisma"].
Do not include any Markdown formatting like \`\`\`json, explanation, or extra characters. Just the JSON array.
`;
        
        const selectionResult = await gemini.chatRaw(fileSelectionPrompt);
        let selectedPaths: string[] = [];
        try {
          const cleanedJson = selectionResult.text.replace(/```json|```/g, "").trim();
          selectedPaths = JSON.parse(cleanedJson);
        } catch {
          selectedPaths = candidatePaths.slice(0, 2);
        }

        // Fetch actual file contents
        const retrievedFiles = [];
        for (const path of selectedPaths) {
          if (filePaths.includes(path)) {
            try {
              const content = await fetchGitHubFileContent(repository.url, path, user.userId);
              if (content) {
                retrievedFiles.push({ path, content: content.substring(0, 6000) }); // Cap each file at 6k characters
              }
            } catch (e) {
              console.warn(`RAG failed to fetch content for ${path}:`, e);
            }
          }
        }

        if (retrievedFiles.length > 0) {
          retrievedFilesContent = retrievedFiles
            .map(f => `File: ${f.path}\nContent:\n\`\`\`\n${f.content}\n\`\`\`\n`)
            .join("\n");
        }
      } catch (err) {
        console.error("RAG codebase retrieval error:", err);
      }
    }

    // Construct the fully grounded RAG prompt
    const enhancedPrompt = `You are an expert developer assistant for the repository "${repository.name}".
You are answering a user's question about the codebase.

Repository Context:
- Name: ${repository.name}
- Description: ${repository.description || "N/A"}
- Languages: ${repository.languages.map((l: any) => `${l.name} (${l.percentage}%)`).join(", ")}
- Stats: ${repository.commits?.length || 0} commits, ${repository.contributors?.length || 0} contributors, ${repository.files?.length || 0} files

${retrievedFilesContent ? `===== RETRIEVED CODEBASE CONTEXT =====\n${retrievedFilesContent}\n===== END RETRIEVED CONTEXT =====\n` : ""}

Answer the following user question using the codebase context above. Ground your answer in the provided file contents and repository context.
If code snippets from the retrieved files are relevant, explain and reference them in detail. If no relevant files are found, answer using the metadata.

User Question: ${question}
`;

    // Invoke Gemini with history and grounded context
    const chatResult = await getGeminiService().chatRaw(enhancedPrompt, standardizedHistory);
    const response = chatResult.text;

    void logAiRequest({
      userId: user.userId,
      ip: getClientIp(request),
      endpoint: "chat",
    });

    return NextResponse.json({ response, question });
  } catch (error: any) {
    console.error("AI chat error:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to process chat" },
      { status: 500 }
    );
  }
}
