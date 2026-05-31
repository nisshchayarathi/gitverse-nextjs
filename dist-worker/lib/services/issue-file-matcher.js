"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueFileMatcherService = void 0;
const geminiService_1 = require("@/lib/services/geminiService");
class IssueFileMatcherService {
    /**
     * Matches an issue's content to the most relevant files in the repository.
     */
    async matchFiles(title, body, repositoryFiles) {
        if (!repositoryFiles || repositoryFiles.length === 0) {
            return [];
        }
        const filePaths = repositoryFiles.map((f) => f.path);
        const issueText = `${title} ${body}`.toLowerCase();
        // Heuristic filtering: find files that mention keywords from the issue
        const keywords = issueText
            .replace(/[^\w\s]/g, "")
            .split(/\s+/)
            .filter((w) => w.length > 3 &&
            !["what", "how", "where", "why", "who", "show", "tell", "explain", "code", "file", "repo", "repository", "this", "that", "there", "with"].includes(w));
        let candidatePaths = filePaths;
        if (keywords.length > 0) {
            candidatePaths = filePaths.filter((path) => {
                const pathLower = path.toLowerCase();
                return keywords.some((kw) => pathLower.includes(kw));
            });
        }
        // Keep candidates within a reasonable list size (max 50)
        if (candidatePaths.length === 0) {
            candidatePaths = filePaths.slice(0, 50);
        }
        else {
            candidatePaths = candidatePaths.slice(0, 50);
        }
        const prompt = `
You are an expert codebase navigation AI. Given the following list of file paths in a repository:
${candidatePaths.join("\n")}

And the following GitHub issue:
Title: ${title}
Body:
${body}

Identify up to 5 files that are most likely to need modification or review to resolve this issue.
Return ONLY valid JSON matching this schema (no markdown formatting, no code fences):
[
  {
    "path": string, // The exact file path from the list above
    "relevanceScore": number, // 0-100
    "reasoning": string // Brief 1-sentence explanation of why this file is relevant
  }
]
`;
        try {
            const gemini = (0, geminiService_1.getGeminiService)();
            const result = await gemini.chatRaw(prompt);
            let rawJson = result.text;
            rawJson = rawJson.replace(/```json/gi, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(rawJson);
            if (!Array.isArray(parsed)) {
                return [];
            }
            return parsed
                .filter((match) => match.path && typeof match.path === "string")
                .slice(0, 5);
        }
        catch (error) {
            console.error("[IssueFileMatcherService] Error matching files:", error);
            return [];
        }
    }
}
exports.IssueFileMatcherService = IssueFileMatcherService;
