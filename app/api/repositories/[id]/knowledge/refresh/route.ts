import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";
import { GitService } from "@/lib/services/gitService";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import * as fs from "fs/promises";
import { gitverseConfigParser } from "@/lib/parsers/gitverseConfigParser";
import { repositoryKnowledgeService } from "@/lib/services/repositoryKnowledgeService";

export async function POST(
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

    // Clone the repo just to read the knowledge configs
    const tempDir = path.join(
      os.tmpdir(),
      "gitverse",
      `knowledge-${repositoryId}-${crypto.randomBytes(8).toString("hex")}`,
    );

    let gitService: GitService | null = null;
    let parsedKnowledge;

    try {
      gitService = await GitService.cloneRepository(repository.url, tempDir, { depth: 1, noSingleBranch: false });
      
      let knowledgeJson = undefined;
      let knowledgeMd = undefined;
      
      try {
        const jsonPath = path.join(tempDir, ".gitverse.json");
        const jsonContent = await fs.readFile(jsonPath, "utf8");
        knowledgeJson = gitverseConfigParser.parseJson(jsonContent);
      } catch (e) { /* Ignore */ }
      
      try {
        const mdPath = path.join(tempDir, ".gitverse.md");
        const mdContent = await fs.readFile(mdPath, "utf8");
        knowledgeMd = gitverseConfigParser.parseMarkdown(mdContent);
      } catch (e) { /* Ignore */ }
      
      parsedKnowledge = gitverseConfigParser.mergeKnowledge(knowledgeJson, knowledgeMd);
      
      await repositoryKnowledgeService.upsertKnowledge(repositoryId, parsedKnowledge);
      
    } finally {
      if (gitService) {
        await gitService.cleanup();
      } else {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null);
      }
    }

    // Format for response
    const formattedKnowledge = {
      ...parsedKnowledge,
      onboardingNotes: parsedKnowledge.onboardingNotes || null,
      architecturePrinciples: parsedKnowledge.architecturePrinciples || null,
    };

    return NextResponse.json({ success: true, knowledge: formattedKnowledge });
  } catch (error: any) {
    console.error("Failed to refresh repository knowledge:", error);
    return NextResponse.json({ error: "Failed to refresh repository knowledge" }, { status: 500 });
  }
}
