import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth, sanitizeError } from "@/lib/middleware";
import { getGeminiService } from "@/lib/services/geminiService";
import { repositoryService } from "@/lib/services/repositoryService";
import { GitHubService } from "@/lib/services/githubService";
import { getDecryptedGitHubToken } from "@/lib/utils/githubToken";
import prisma from "@/lib/prisma";
import axios from "axios";

// Helper to fetch file content from GitHub
async function fetchGitHubFileContent(url: string, filePath: string, userId: number): Promise<string> {
  const ownerRepo = GitHubService.parseGitHubUrl(url);
  if (!ownerRepo) return "";
  const { owner, repo } = ownerRepo;

  const token = await getDecryptedGitHubToken(userId);

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
    const body = await request.json();
    const { repositoryId } = body;

    if (!repositoryId) {
      return NextResponse.json(
        { error: "Repository ID is required" },
        { status: 400 }
      );
    }

    const repository = await repositoryService.getRepository(
      Number(repositoryId),
      user.userId
    );

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    // Identify manifest files in the repository
    const files = (repository as any).files || [];
    const manifestCandidates = ["package.json", "requirements.txt", "go.mod", "Cargo.toml", "Gemfile", "build.gradle", "pom.xml"];
    
    let manifestFile = null;
    let manifestContent = "";

    for (const candidate of manifestCandidates) {
      const found = files.find((f: any) => f.path.toLowerCase() === candidate || f.path.toLowerCase().endsWith("/" + candidate));
      if (found) {
        manifestFile = found.path;
        try {
          manifestContent = await fetchGitHubFileContent(repository.url, found.path, user.userId);
          if (manifestContent) break; // Use the first successfully fetched manifest
        } catch (e) {
          console.warn(`Failed fetching content for manifest ${found.path}:`, e);
        }
      }
    }

    // Build standard file tree representation
    const filePaths = files.map((f: any) => f.path);
    const fileTree = filePaths.slice(0, 100).join("\n"); // Cap to 100 files for quick structure representation

    const languagesStr = repository.languages
      .map((l: any) => `${l.name} (${l.percentage}%)`)
      .join(", ");

    // Construct prompt for Gemini
    const prompt = `
You are an expert technical writer and software developer. Generate a comprehensive, beautiful, and professional README.md for this repository.

Repository Details:
- Name: ${repository.name}
- Description: ${repository.description || "No description provided."}
- Primary Languages: ${languagesStr || "Unknown"}
- Default Branch: ${repository.defaultBranch || "main"}

${manifestFile ? `Manifest File Name: ${manifestFile}` : ""}
${manifestContent ? `Manifest Content (to infer dependencies and setup):\n\`\`\`\n${manifestContent.substring(0, 5000)}\n\`\`\`` : ""}

File Structure (First 100 files):
\`\`\`
${fileTree}
\`\`\`

Instructions:
1. Provide a clear and engaging Project Title and Description.
2. Under "Features", list the core features based on the file structure and manifest.
3. Under "Tech Stack", list the technologies, frameworks, and packages inferred from the manifest and languages.
4. Under "Getting Started", provide clear prerequisites and installation/setup/run instructions matching the detected tech stack (e.g., if package.json is present, use npm/yarn; if requirements.txt, use pip, etc.).
5. Under "Project Structure", explain the high-level organization of the repository.
6. Provide a section for "Contributing" and "License" (use MIT as default if none detected).
7. Format the output in clean, valid Markdown. Do NOT wrap the entire output in a markdown block, just output the markdown content directly.
`;

    const gemini = getGeminiService();
    const markdown = await gemini.chatRaw(prompt);

    return NextResponse.json({
      markdown,
      inferredStack: manifestFile ? manifestFile.split("/").pop() : "Generic",
    });
  } catch (error: any) {
    console.error("README generation error:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to generate README" },
      { status: 500 }
    );
  }
}
