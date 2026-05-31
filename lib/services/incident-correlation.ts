import { getGeminiService } from "./geminiService";
import { IncidentPayload, IncidentCorrelation } from "@/types/incident-response";

export class IncidentCorrelationService {
  /**
   * Correlates an incoming incident with recent code changes using Gemini.
   */
  public async correlateIncident(
    incident: IncidentPayload,
    repositoryContext: string
  ): Promise<IncidentCorrelation> {
    console.log(`[IncidentCorrelation] Starting correlation for incident: ${incident.title}`);

    const prompt = `
You are a site reliability engineer and an expert code analyst.
An incident has occurred in production. Please analyze the incident details and the recent repository context to identify the most likely root cause.

Incident Details:
- Title: ${incident.title}
- Severity: ${incident.severity}
- Service: ${incident.affectedService || "Unknown"}
- Timestamp: ${incident.timestamp}
- Environment: ${incident.environment}

Stack Trace / Error Details:
${incident.stackTrace || "None provided"}

Repository Context (Recent PRs, Commits, Deployments):
${repositoryContext}

Based on this information, extract the following in JSON format:
{
  "likelyPrNumber": number (the ID of the PR most likely to have caused this, or null),
  "likelyCommitSha": string (the SHA of the offending commit, or null),
  "impactedFiles": string[] (list of files likely involved in the incident),
  "impactedServices": string[] (services affected),
  "confidenceScore": number (0-100 indicating how confident you are in this assessment),
  "analysisDetails": string (brief explanation of the probable cause and reasoning)
}

Provide ONLY the valid JSON object and nothing else.
`;

    const geminiService = getGeminiService();
    try {
      const response = await geminiService.chatRaw(prompt);
      
      // Attempt to parse JSON response. Gemini might wrap it in ```json
      let responseText = response.text.trim();
      if (responseText.startsWith("\`\`\`json")) {
        responseText = responseText.replace(/^\`\`\`json/, "").replace(/\`\`\`$/, "").trim();
      } else if (responseText.startsWith("\`\`\`")) {
        responseText = responseText.replace(/^\`\`\`/, "").replace(/\`\`\`$/, "").trim();
      }

      const parsed = JSON.parse(responseText);

      return {
        likelyPrNumber: parsed.likelyPrNumber,
        likelyCommitSha: parsed.likelyCommitSha,
        impactedFiles: parsed.impactedFiles || [],
        impactedServices: parsed.impactedServices || [],
        confidenceScore: parsed.confidenceScore || 0,
        analysisDetails: parsed.analysisDetails || "No detailed analysis provided.",
      };
    } catch (error) {
      console.error("[IncidentCorrelation] Failed to correlate incident:", error);
      return {
        impactedFiles: [],
        impactedServices: [],
        confidenceScore: 0,
        analysisDetails: "Correlation failed due to an error.",
      };
    }
  }
}

let correlationServiceSingleton: IncidentCorrelationService | null = null;

export function getIncidentCorrelationService(): IncidentCorrelationService {
  if (!correlationServiceSingleton) {
    correlationServiceSingleton = new IncidentCorrelationService();
  }
  return correlationServiceSingleton;
}
