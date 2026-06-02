import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { repositoryKnowledgeService } from "@/lib/services/repositoryKnowledgeService";
import { repositoryService } from "@/lib/services/repositoryService";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const repositoryId = parseInt(params.id, 10);

    if (isNaN(repositoryId)) {
      return NextResponse.json({ error: "Invalid repository ID" }, { status: 400 });
    }

    const repository = await repositoryService.getRepository(repositoryId, user.userId);
    if (!repository) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }

    const knowledge = await repositoryKnowledgeService.getKnowledge(repositoryId);
    
    // Parse JSON strings back to objects for API response
    let formattedKnowledge = null;
    if (knowledge) {
      formattedKnowledge = {
        ...knowledge,
        onboardingNotes: knowledge.onboardingNotes ? JSON.parse(knowledge.onboardingNotes as string) : null,
        architecturePrinciples: knowledge.architecturePrinciples ? JSON.parse(knowledge.architecturePrinciples as string) : null,
      };
    }

    return NextResponse.json({ knowledge: formattedKnowledge });
  } catch (error: any) {
    console.error("Failed to fetch repository knowledge:", error);
    return NextResponse.json({ error: "Failed to fetch repository knowledge" }, { status: 500 });
  }
}
