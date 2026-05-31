import { getGeminiService } from "@/lib/services/geminiService";

export class APIRefactorService {
  /**
   * Identifies usages of the upgraded package and refactors the code to accommodate breaking changes.
   */
  async refactorFile(
    filePath: string,
    fileContent: string,
    packageName: string,
    fromVersion: string,
    toVersion: string
  ): Promise<{ newContent: string; confidenceScore: number } | null> {
    const gemini = getGeminiService();

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
      } else if (rawText.startsWith("```")) {
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
    } catch (error) {
      console.error(`[APIRefactor] Failed to refactor ${filePath}:`, error);
      return null;
    }
  }
}
