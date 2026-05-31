"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIRefactorService = void 0;
const geminiService_1 = require("@/lib/services/geminiService");
class APIRefactorService {
    /**
     * Identifies usages of the upgraded package and refactors the code to accommodate breaking changes.
     */
    async refactorFile(filePath, fileContent, packageName, fromVersion, toVersion) {
        const gemini = (0, geminiService_1.getGeminiService)();
        const prompt = `
You are an expert security researcher and software engineer.
We are upgrading the dependency "${packageName}" from version ${fromVersion} to ${toVersion} in order to patch a security vulnerability.
This may involve breaking API changes.

Here is the content of the file ${filePath}:
\`\`\`
${fileContent}
\`\`\`

If this file uses "${packageName}", analyze the usage and refactor the code to be compatible with version ${toVersion}.
If the file does not use "${packageName}" or requires no changes, set "requiresChanges" to false.

Return ONLY valid JSON matching this schema (no markdown, no extra text):
{
  "requiresChanges": boolean,
  "newContent": string,
  "confidenceScore": number
}
`;
        try {
            const response = await gemini.chatRaw(prompt);
            const rawText = response.text.trim();
            let jsonText = rawText;
            if (rawText.startsWith("```json")) {
                jsonText = rawText.replace(/^```json/, "").replace(/```$/, "").trim();
            }
            else if (rawText.startsWith("```")) {
                jsonText = rawText.replace(/^```/, "").replace(/```$/, "").trim();
            }
            const parsed = JSON.parse(jsonText);
            if (!parsed.requiresChanges || !parsed.newContent) {
                return null;
            }
            return {
                newContent: parsed.newContent,
                confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 50,
            };
        }
        catch (error) {
            console.error(`[APIRefactor] Failed to refactor ${filePath}:`, error);
            return null;
        }
    }
}
exports.APIRefactorService = APIRefactorService;
