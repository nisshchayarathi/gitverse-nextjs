import { getGeminiService } from "@/lib/services/geminiService";
import { ImpactReport, RiskLevel } from "../../types/dependency-impact";

export class RiskAssessmentService {
  /**
   * Evaluates the risk of a set of changes by providing the files and their dependents to Gemini.
   */
  async assessRisk(
    changedFilesContent: { path: string; content: string }[],
    affectedFiles: string[]
  ): Promise<Pick<ImpactReport, "riskLevel" | "reasoning" | "suggestedFollowUpChecks" | "confidenceScore">> {
    const gemini = getGeminiService();

    const fileListStr = changedFilesContent
      .map(f => `File: ${f.path}\n\`\`\`\n${f.content.substring(0, 5000)}\n\`\`\``)
      .join("\n\n");
    
    const affectedFilesStr = affectedFiles.join("\n- ");

    const prompt = `
You are an expert software architect. Analyze the provided changed files and their downstream dependents to determine the risk level of the changes.

Changed Files:
${fileListStr}

Downstream Dependents (Potentially Affected):
- ${affectedFiles.length > 0 ? affectedFilesStr : "None"}

Evaluate whether these changes introduce breaking API changes, alter function signatures, remove exports, modify return types, or alter component props in a way that would break the downstream dependents.

Return a JSON object exactly matching this schema (no markdown formatting, no comments, just valid JSON):
{
  "riskLevel": "Low" | "Medium" | "High",
  "reasoning": string,
  "suggestedFollowUpChecks": string[],
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
      
      const validRiskLevels = ["Low", "Medium", "High"];
      const riskLevel = validRiskLevels.includes(parsed.riskLevel) ? parsed.riskLevel : "Medium";

      return {
        riskLevel: riskLevel as RiskLevel,
        reasoning: parsed.reasoning || "Failed to determine reasoning.",
        suggestedFollowUpChecks: Array.isArray(parsed.suggestedFollowUpChecks) ? parsed.suggestedFollowUpChecks : [],
        confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 50
      };
    } catch (error) {
      console.error("[RiskAssessment] Failed to parse analysis result:", error);
      return {
        riskLevel: "Medium",
        reasoning: "AI analysis failed or was unable to parse the result. Manual review recommended.",
        suggestedFollowUpChecks: ["Verify downstream consumers manually."],
        confidenceScore: 0
      };
    }
  }
}
