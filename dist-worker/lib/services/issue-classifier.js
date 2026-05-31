"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueClassifierService = void 0;
const geminiService_1 = require("@/lib/services/geminiService");
class IssueClassifierService {
    /**
     * Analyzes an issue's title and body to classify it into a category and extract tags.
     */
    async classifyIssue(title, body) {
        const prompt = `
You are an expert technical product manager. Analyze the following GitHub issue and classify it.

Issue Title: ${title}
Issue Body:
${body}

Return ONLY valid JSON matching this schema (no markdown formatting, no code fences):
{
  "category": "bug" | "enhancement" | "documentation" | "refactor" | "performance" | "security" | "ui/ux" | "testing" | "question" | "unknown",
  "tags": string[], // 1-5 specific tags relevant to the issue
  "confidence": number // 0-100 indicating how confident you are in this classification
}
`;
        try {
            const gemini = (0, geminiService_1.getGeminiService)();
            const result = await gemini.chatRaw(prompt);
            let rawJson = result.text;
            // Clean markdown formatting if any
            rawJson = rawJson.replace(/```json/gi, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(rawJson);
            return {
                category: parsed.category || "unknown",
                tags: Array.isArray(parsed.tags) ? parsed.tags : [],
                confidence: typeof parsed.confidence === "number" ? parsed.confidence : 50,
            };
        }
        catch (error) {
            console.error("[IssueClassifierService] Error classifying issue:", error);
            return {
                category: "unknown",
                tags: [],
                confidence: 0,
            };
        }
    }
}
exports.IssueClassifierService = IssueClassifierService;
