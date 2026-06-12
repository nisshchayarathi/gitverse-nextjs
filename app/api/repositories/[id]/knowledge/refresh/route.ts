import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";
import { GitService } from "@/lib/services/gitService";
import { getGithubAccessToken } from "@/lib/services/githubAuthService";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import * as fs from "fs/promises";
import { gitverseConfigParser } from "@/lib/parsers/gitverseConfigParser";
import { repositoryKnowledgeService } from "@/lib/services/repositoryKnowledgeService";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/middleware/rateLimit";
import prisma from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const rl = await checkRateLimit(String(user.userId), RATE_LIMITS.REPOSITORY_KNOWLEDGE_REFRESH);
    if (!rl.allowed) return rateLimitResponse(rl);
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
    let configWarning: string | null = null;

    try {
      const refreshController = new AbortController();
      const refreshTimeout = setTimeout(() => refreshController.abort(), 5 * 60 * 1000);

      try {
        const token = await getGithubAccessToken(user.userId);
        gitService = await GitService.cloneRepository(repository.url, tempDir, {
          depth: 1,
          noSingleBranch: false,
          accessToken: token,
          signal: refreshController.signal,
        });
      } finally {
        clearTimeout(refreshTimeout);
      }
      
      let knowledgeJson = undefined;
      let knowledgeMd = undefined;
      
      try {
        const jsonPath = path.join(tempDir, ".gitverse.json");
        const jsonContent = await fs.readFile(jsonPath, "utf8");
        try {
          knowledgeJson = gitverseConfigParser.parseJson(jsonContent);
        } catch (e: any) {
          const warnMsg = `Failed to parse .gitverse.json: ${e.message}`;
          console.warn(warnMsg);
          configWarning = warnMsg;
        }
      } catch (e: any) {
        if (e.code !== "ENOENT") {
          const warnMsg = `Failed to read .gitverse.json: ${e.message}`;
          console.warn(warnMsg);
          configWarning = warnMsg;
        }
      }
      
      try {
        const mdPath = path.join(tempDir, ".gitverse.md");
        const mdContent = await fs.readFile(mdPath, "utf8");
        try {
          knowledgeMd = gitverseConfigParser.parseMarkdown(mdContent);
        } catch (e: any) {
          const warnMsg = `Failed to parse .gitverse.md: ${e.message}`;
          console.warn(warnMsg);
          configWarning = configWarning ? `${configWarning}; ${warnMsg}` : warnMsg;
        }
      } catch (e: any) {
        if (e.code !== "ENOENT") {
          const warnMsg = `Failed to read .gitverse.md: ${e.message}`;
          console.warn(warnMsg);
          configWarning = configWarning ? `${configWarning}; ${warnMsg}` : warnMsg;
        }
      }
      
      parsedKnowledge = gitverseConfigParser.mergeKnowledge(knowledgeJson, knowledgeMd);
      
      await repositoryKnowledgeService.upsertKnowledge(repositoryId, parsedKnowledge);
      
      await prisma.repository.update({
        where: { id: repositoryId },
        data: { configWarning: configWarning || null },
      });
      
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

    return NextResponse.json({ success: true, knowledge: formattedKnowledge, configWarning });
  } catch (error: any) {
    console.error("Failed to refresh repository knowledge:", error);
    return NextResponse.json({ error: "Failed to refresh repository knowledge" }, { status: 500 });
  }
}
