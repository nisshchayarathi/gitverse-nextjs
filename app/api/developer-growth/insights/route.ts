import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth, sanitizeError } from "@/lib/middleware";
import { getGeminiService } from "@/lib/services/geminiService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    
    let body;
    try {
      body = await request.json();
    } catch (jsonErr) {
      return NextResponse.json(
        { error: "Malformed request payload" },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request payload structure" },
        { status: 400 }
      );
    }

    const { username, metrics, repos } = body;

    if (!username || typeof username !== "string") {
      return NextResponse.json(
        { error: "GitHub username is required and must be a string" },
        { status: 400 }
      );
    }

    const languagesList = metrics?.languages || [];
    const eventsBreakdown = metrics?.eventsBreakdown || {};
    const momentumScore = metrics?.momentumScore || 0;

    const prompt = `
You are the GitVerse Developer Growth Intelligence AI.
Analyze the following developer metrics extracted from the public GitHub profile and events of "${username}":

Developer Momentum Score: ${momentumScore}/1000
Recent Activity Events: ${JSON.stringify(eventsBreakdown)}
Top Languages: ${JSON.stringify(languagesList)}
Repositories (subset): ${JSON.stringify((repos || []).slice(0, 10))}

Based on this data, provide developer growth intelligence and analytics in the following JSON format. Ensure the response is valid JSON and contains only the JSON object. Do not include markdown code block formatting (like \`\`\`json).

JSON Schema:
{
  "techStackOverview": "A brief, encouraging, professional summary of the developer's current tech stack, strengths, and overall trajectory (2-3 sentences).",
  "emergingTrends": [
    "Trend 1 (e.g., 'Increasing focus on React/Next.js')",
    "Trend 2"
  ],
  "inactiveSkills": [
    "Skill 1 (e.g., 'Python activity has decreased in the last 90 days. Consider a small project to brush up.')",
    "Skill 2"
  ],
  "consistencyAlerts": [
    "Alert 1 (e.g., 'High coding activity on weekends, lower on weekdays. Try a 15-minute daily habit.')"
  ],
  "underutilizedRepos": [
    {
      "name": "repository-name",
      "reason": "Why it is underutilized and what they can do (e.g., 'Has stars but no updates in 6 months. Consider adding a Readme or refactoring to latest Next.js.')"
    }
  ],
  "growthRecommendations": [
    "Recommendation 1 (e.g., 'Learn TypeScript: Since you write a lot of JavaScript, TypeScript will improve your type safety and code quality.')",
    "Recommendation 2"
  ]
}
`;

    let insights;
    try {
      const responseText = await getGeminiService().chatRaw(prompt);
      
      // Attempt to parse JSON from the response text
      const cleanJsonText = responseText
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();
      
      insights = JSON.parse(cleanJsonText);
      if (!isValidAIInsights(insights)) {
        throw new Error("AI response does not match the expected JSON schema structure");
      }
    } catch (aiError) {
      console.warn("AI generation failed, parse error, or schema validation failed, using fallbacks:", aiError);
      
      // Dynamic fallback mock data based on actual input metrics
      const topLang = languagesList[0]?.name || "JavaScript";
      insights = {
        techStackOverview: `A productive developer focused on ${topLang} and modern software development. Your profile demonstrates solid contribution momentum with a score of ${momentumScore}/1000.`,
        emergingTrends: [
          `Active utilization of ${topLang} in recent repositories.`,
          "Increased focus on web applications and frontend/backend integration."
        ],
        inactiveSkills: [
          languagesList.length > 2 
            ? `Decrease in recent activity for ${languagesList[languagesList.length - 1]?.name || "older stacks"}.` 
            : "No significant inactive skills detected. Keep diversifying your stack!"
        ],
        consistencyAlerts: [
          "Recent coding activity shows good bursts of commits. Establishing a regular daily commit habit can help build longer streaks."
        ],
        underutilizedRepos: (repos || []).slice(0, 2).map((r: any) => ({
          name: r.name,
          reason: "An interesting project that could benefit from updated documentation and a clear LICENSE to attract contributors."
        })),
        growthRecommendations: [
          `Strengthen mastery of ${topLang} by incorporating modern design pattern paradigms.`,
          "Increase collaboration by contributing to open-source repositories and creating Pull Requests."
        ]
      };
    }

    return NextResponse.json({ insights }, { status: 200 });
  } catch (error: any) {
    console.error("Developer growth insights error:", sanitizeError(error));
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Failed to generate growth insights" },
      { status: 500 }
    );
  }
}

function isValidAIInsights(data: any): boolean {
  if (!data || typeof data !== "object") return false;
  if (typeof data.techStackOverview !== "string") return false;
  
  if (!Array.isArray(data.emergingTrends) || !data.emergingTrends.every((t: any) => typeof t === "string")) return false;
  if (!Array.isArray(data.inactiveSkills) || !data.inactiveSkills.every((s: any) => typeof s === "string")) return false;
  if (!Array.isArray(data.consistencyAlerts) || !data.consistencyAlerts.every((a: any) => typeof a === "string")) return false;
  
  if (!Array.isArray(data.growthRecommendations) || !data.growthRecommendations.every((r: any) => typeof r === "string")) return false;
  
  if (!Array.isArray(data.underutilizedRepos)) return false;
  for (const repo of data.underutilizedRepos) {
    if (!repo || typeof repo !== "object") return false;
    if (typeof repo.name !== "string" || typeof repo.reason !== "string") return false;
  }
  
  return true;
}
