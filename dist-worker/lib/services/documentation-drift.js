"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentationDriftService = void 0;
const documentation_analyzer_1 = require("./documentation-analyzer");
const documentation_generator_1 = require("./documentation-generator");
const documentation_pr_1 = require("./documentation-pr");
const githubService_1 = require("./githubService");
const githubAppService_1 = require("./githubAppService");
const prisma_1 = __importDefault(require("@/lib/prisma"));
class DocumentationDriftService {
    analyzer;
    generator;
    prService;
    constructor() {
        this.analyzer = new documentation_analyzer_1.DocumentationAnalyzerService();
        this.generator = new documentation_generator_1.DocumentationGeneratorService();
        this.prService = new documentation_pr_1.DocumentationPRService();
    }
    /**
     * Orchestrates the drift detection and auto-update process for a repository.
     * Scans a sample of files and attempts to generate a PR for the first drifting file found.
     */
    async runDriftDetection(context) {
        const { owner, repo, installationId, repositoryId } = context;
        // Fetch up to 10 source files from the DB to analyze
        const filesToAnalyze = await prisma_1.default.file.findMany({
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
        const app = new githubAppService_1.GitHubAppService();
        const token = await app.getInstallationAccessToken(Number(installationId));
        const github = new githubService_1.GitHubService(token);
        let filesAnalyzed = 0;
        let driftedFiles = 0;
        let prUrl = null;
        // Minimum confidence thresholds (can be made configurable)
        const DRIFT_CONFIDENCE_THRESHOLD = 85;
        const FIX_CONFIDENCE_THRESHOLD = 85;
        for (const fileRecord of filesToAnalyze) {
            filesAnalyzed++;
            try {
                // 1. Fetch file content
                const content = await github.getFileContent(owner, repo, fileRecord.path);
                if (!content)
                    continue;
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
                        }
                        else {
                            console.log(`[DocumentationDrift] Fix confidence ${patch.suggestedFixConfidence} below threshold for ${fileRecord.path}`);
                        }
                    }
                }
            }
            catch (err) {
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
exports.DocumentationDriftService = DocumentationDriftService;
