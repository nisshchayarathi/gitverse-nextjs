import { DocumentationAnalyzerService } from "./documentation-analyzer";
import { DocumentationGeneratorService } from "./documentation-generator";
import { DocumentationPRService } from "./documentation-pr";
import { DriftDetectionJobContext } from "../../types/documentation-drift";
import { GitHubService } from "./githubService";
import { GitHubAppService } from "./githubAppService";
import prisma from "@/lib/prisma";

export class DocumentationDriftService {
  private analyzer: DocumentationAnalyzerService;
  private generator: DocumentationGeneratorService;
  private prService: DocumentationPRService;

  constructor() {
    this.analyzer = new DocumentationAnalyzerService();
    this.generator = new DocumentationGeneratorService();
    this.prService = new DocumentationPRService();
  }

  /**
   * Orchestrates the drift detection and auto-update process for a repository.
   * Scans a sample of files and attempts to generate a PR for the first drifting file found.
   */
  async runDriftDetection(context: DriftDetectionJobContext): Promise<{
    filesAnalyzed: number;
    driftedFiles: number;
    prUrl: string | null;
  }> {
    const { owner, repo, installationId, repositoryId } = context;

    // Fetch up to 10 source files from the DB to analyze
    const filesToAnalyze = await prisma.file.findMany({
      where: {
        repositoryId,
        extension: {
          in: [".ts", ".tsx", ".js", ".jsx", ".md"]
        }
      },
      take: 10,
      orderBy: {
        updatedAt: 'desc' // Analyze recently updated files
      }
    });

    if (filesToAnalyze.length === 0) {
      return { filesAnalyzed: 0, driftedFiles: 0, prUrl: null };
    }

    const app = new GitHubAppService();
    const token = await app.getInstallationAccessToken(Number(installationId));
    const github = new GitHubService(token);

    let filesAnalyzed = 0;
    let driftedFiles = 0;
    let prUrl: string | null = null;

    // Minimum confidence thresholds (can be made configurable)
    const DRIFT_CONFIDENCE_THRESHOLD = 85;
    const FIX_CONFIDENCE_THRESHOLD = 85;

    for (const fileRecord of filesToAnalyze) {
      filesAnalyzed++;
      
      try {
        // 1. Fetch file content
        const content = await github.getFileContent(owner, repo, fileRecord.path);
        if (!content) continue;

        // 2. Analyze for drift
        const driftResult = await this.analyzer.analyzeDrift(fileRecord.path, content);
        
        if (driftResult.hasDrift && driftResult.driftConfidence >= DRIFT_CONFIDENCE_THRESHOLD) {
          driftedFiles++;

          // Prevent opening multiple PRs per run (to avoid spam)
          if (!prUrl) {
            // 3. Generate fix
            const patch = await this.generator.generatePatch(fileRecord.path, content, driftResult);

            if (patch.suggestedFixConfidence >= FIX_CONFIDENCE_THRESHOLD) {
              // 4. Create PR
              console.log(`[DocumentationDrift] Generating PR for ${fileRecord.path}`);
              const url = await this.prService.createPR({
                owner,
                repo,
                filePath: fileRecord.path,
                patch,
                githubToken: token,
              });
              
              if (url) {
                prUrl = url;
              }
            } else {
               console.log(`[DocumentationDrift] Fix confidence ${patch.suggestedFixConfidence} below threshold for ${fileRecord.path}`);
            }
          }
        }
      } catch (err) {
        console.error(`[DocumentationDrift] Error analyzing ${fileRecord.path}:`, err);
      }
    }

    return {
      filesAnalyzed,
      driftedFiles,
      prUrl,
    };
  }
}
