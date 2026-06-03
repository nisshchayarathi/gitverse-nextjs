import prisma from "../prisma";
import { GitService } from "./gitService";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import * as fs from "fs/promises";
import { invalidateGeminiAnalysisCacheForRepository } from "./geminiAnalysisCacheService";
import { FileChangeType } from "@prisma/client";
import { repoSyncLimiter } from "../utils/concurrencyLimiter";
import { withDbRetry } from "../utils/dbRetry";
import { getGeminiService } from "./geminiService";
import { getGithubAccessToken } from "./githubAuthService";

function yieldIfHighMemory(threshold?: number): Promise<void> {
  if (threshold === undefined) {
    const envThreshold = process.env.GITVERSE_MEM_YIELD_THRESHOLD;
    threshold = envThreshold ? parseFloat(envThreshold) : 0.7;
    if (isNaN(threshold)) threshold = 0.7;
  }

  const usage = process.memoryUsage();
  if (usage.heapUsed / usage.heapTotal > threshold) {
    return new Promise((resolve) => setImmediate(resolve));
  }
  return Promise.resolve();
}

export interface AnalyzeRepositoryInput {
  name: string;
  url: string;
  description?: string;
  targetDirectory?: string;
  userId: number;
  isPrivate?: boolean;
}

export type RepositoryAnalysisProgress = {
  progressPercent?: number;
  progressMessage?: string;
  progressDetails?: unknown;
};

export type RepositoryAnalysisProgressReporter = (
  update: RepositoryAnalysisProgress,
) => void | Promise<void>;

export class RepositoryService {
  private async tryReadmeFromRepoPath(repoPath: string): Promise<{
    path: string;
    text: string;
  } | null> {
    const candidates = [
      "readme.md",
      "readme.markdown",
      "readme.mdx",
      "readme.txt",
      "readme.rst",
      "readme",
    ];

    try {
      const entries = await fs.readdir(repoPath, { withFileTypes: true });
      const fileNames = entries
        .filter((e) => e.isFile())
        .map((e) => e.name)
        .filter(Boolean);

      const byLower = new Map(fileNames.map((n) => [n.toLowerCase(), n]));

      for (const lower of candidates) {
        const actual = byLower.get(lower);
        if (!actual) continue;

        const fullPath = path.join(repoPath, actual);
        const content = await fs.readFile(fullPath, "utf8");
        const trimmed = content.trim();
        if (!trimmed) return null;

        // Prevent huge README payloads from bloating DB / responses.
        const maxChars = 200_000;
        const safeText =
          trimmed.length > maxChars ? trimmed.slice(0, maxChars) : trimmed;

        return { path: actual, text: safeText };
      }

      return null;
    } catch {
      return null;
    }
  }

  async fetchAndStoreReadme(repositoryId: number, userId: number) {
    const repository = await prisma.repository.findFirst({
      where: { id: repositoryId, userId },
      select: { id: true, url: true, targetDirectory: true },
    });

    if (!repository) {
      throw new Error("Repository not found");
    }

    const tempDir = path.join(
      os.tmpdir(),
      "gitverse",
      `readme-${repositoryId}-${crypto.randomBytes(8).toString("hex")}`,
    );

    let gitService: GitService | null = null;

    try {
      // Check repository size before cloning
      const MAX_REPO_SIZE = 500 * 1024 * 1024; // 500 MB limit
      const token = await getGithubAccessToken(userId);
      const remoteSize = await GitService.getRemoteRepositorySize(repository.url, token);
      if (remoteSize !== null && remoteSize > MAX_REPO_SIZE) {
        throw new Error(`Repository exceeds maximum allowed size of 500MB (${(remoteSize / 1024 / 1024).toFixed(2)}MB).`);
      }

      // For README we don't need all branches; keep it lightweight.
      gitService = await GitService.cloneRepository(repository.url, tempDir, {
        depth: 1,
        noSingleBranch: false,
        accessToken: token,
      });

      const scopedPath = repository.targetDirectory
        ? path.join(tempDir, repository.targetDirectory)
        : null;

      const readme =
        (scopedPath
          ? await this.tryReadmeFromRepoPath(scopedPath)
          : null) ?? (await this.tryReadmeFromRepoPath(tempDir));

      const updated = await prisma.repository.update({
        where: { id: repositoryId },
        data: {
          readmePath: readme?.path ?? "README.md",
          readmeText: readme?.text ?? "doesnt exist",
          readmeFetchedAt: new Date(),
        },
      });

      return updated;
    } finally {
      if (gitService) {
        await gitService.cleanup();
      } else {
        await fs
          .rm(tempDir, { recursive: true, force: true })
          .catch(() => null);
      }
    }
  }

  /**
   * Create a new repository record or return existing one
   */
  async createRepository(input: AnalyzeRepositoryInput) {
    // Check if repository with same URL already exists for this user
    const existingRepository = await prisma.repository.findFirst({
      where: {
        url: input.url,
        userId: input.userId,
        targetDirectory: input.targetDirectory ?? null,
      },
    });

    if (existingRepository) {

      return existingRepository;
    }

    const existingRepositoryName = await prisma.repository.findFirst({
  where: {
    name: input.name,
    userId: input.userId,
  },
});

if (existingRepositoryName) {
  throw new Error("Repository with this name already exists");
}

    const repository = await prisma.repository.create({
      data: {
        name: input.name,
        url: input.url,
        description: input.description,
        targetDirectory: input.targetDirectory ?? null,
        userId: input.userId,
        status: "pending",
        isPrivate: input.isPrivate ?? false,
      },
    });

    return repository;
  }

  /**
   * Analyze a repository and store all data
   */
  async analyzeRepository(
    repositoryId: number,
    userId: number,
    opts?: { onProgress?: RepositoryAnalysisProgressReporter; scope?: string; timeoutMs?: number },
  ) {
    const repository = await prisma.repository.findFirst({
      where: { id: repositoryId, userId },
    });

    if (!repository) {
      throw new Error("Repository not found");
    }

    // Update status to analyzing
    await prisma.repository.update({
      where: { id: repositoryId },
      data: { status: "analyzing" },
    });

    const report = async (update: RepositoryAnalysisProgress) => {
      if (!opts?.onProgress) return;
      try {
        await opts.onProgress(update);
      } catch {
        // Progress reporting must never break analysis.
      }
    };

    await report({ progressPercent: 1, progressMessage: "Starting analysis..." });

    const timeoutMs = opts?.timeoutMs ?? 15 * 60 * 1000; // 15 minutes default
    const controller = new AbortController();
    const { signal } = controller;
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    const checkAborted = () => {
      if (signal.aborted) {
        throw new Error(`Repository analysis timed out after ${timeoutMs / 60000} minutes`);
      }
    };

    // Create temporary directory for cloning
    const tempDir = path.join(
      os.tmpdir(),
      "gitverse",
      `repo-${repositoryId}-${crypto.randomBytes(8).toString("hex")}`,
    );

    let gitService: GitService | null = null;

    try {
      checkAborted();

      // Check repository size before cloning to prevent disk exhaustion DoS
      const MAX_REPO_SIZE = 500 * 1024 * 1024; // 500 MB limit
      const token = await getGithubAccessToken(userId);
      const remoteSize = await GitService.getRemoteRepositorySize(repository.url, token);
      if (remoteSize !== null && remoteSize > MAX_REPO_SIZE) {
        throw new Error(`Repository exceeds maximum allowed size of 500MB (${(remoteSize / 1024 / 1024).toFixed(2)}MB).`);
      }

      // Clone repository
      await report({
        progressPercent: 5,
        progressMessage: "Cloning repository...",
      });
      gitService = await GitService.cloneRepository(repository.url, tempDir, {
        signal,
        accessToken: token,
        onProgress: (pct, msg) => {
          const analysisPct = 5 + Math.round((pct / 100) * 3);
          report({ progressPercent: Math.min(8, analysisPct), progressMessage: msg });
        },
      });

      checkAborted();

      // Read phases: all git/fs operations happen before the write transaction.
      await report({ progressPercent: 8, progressMessage: "Reading README" });
      const scopedReadmePath = repository.targetDirectory
        ? path.join(tempDir, repository.targetDirectory)
        : null;
      const readme =
        (scopedReadmePath
          ? await this.tryReadmeFromRepoPath(scopedReadmePath)
          : null) ?? (await this.tryReadmeFromRepoPath(tempDir));

      checkAborted();

      await report({ progressPercent: 9, progressMessage: "Checking AI context configuration" });
      
      let knowledgeJson: ParsedRepositoryKnowledge | undefined = undefined;
      let knowledgeMd: ParsedRepositoryKnowledge | undefined = undefined;
      
      try {
        const jsonPath = path.join(tempDir, ".gitverse.json");
        const jsonContent = await fs.readFile(jsonPath, "utf8");
        knowledgeJson = gitverseConfigParser.parseJson(jsonContent);
      } catch (e) { /* Ignore missing or invalid */ }
      
      try {
        const mdPath = path.join(tempDir, ".gitverse.md");
        const mdContent = await fs.readFile(mdPath, "utf8");
        knowledgeMd = gitverseConfigParser.parseMarkdown(mdContent);
      } catch (e) { /* Ignore missing or invalid */ }
      
      const parsedKnowledge = gitverseConfigParser.mergeKnowledge(knowledgeJson, knowledgeMd);

      checkAborted();

      await report({
        progressPercent: 10,
        progressMessage: "Calculating repository size...",
      });
      const [size, branches] = await Promise.all([
        gitService.getRepositorySize(),
        gitService.getBranches(),
      ]);

      checkAborted();

      const defaultBranch = branches.find((b) => b.isDefault)?.name || "main";

      await report({
        progressPercent: 25,
        progressMessage: "Fetching commit history...",
      });
      const commits = await gitService.getCommits("--all", 1000);

      checkAborted();

      await report({
        progressPercent: 65,
        progressMessage: "Scanning files",
      });
      const files = await gitService.getFileTree(opts?.scope || repository.targetDirectory || undefined);
      checkAborted();

      await report({
        progressPercent: 80,
        progressMessage: "Analyzing contributor activity...",
      });
      await report({
        progressPercent: 85,
        progressMessage: "Detecting programming languages...",
      });

      const [contributors, languages] = await Promise.all([
        gitService.getContributors(),
        gitService.detectLanguages(repository.targetDirectory ?? undefined),
      ]);

      checkAborted();

      // Write phase: all database writes in a single atomic transaction.
      // This ensures that a failure mid-way rolls back all changes, preventing
      // the repository from being stuck in "analyzing" with partial data visible.
      await prisma.$transaction(async (tx) => {
        // Delete stale analysis data for a clean slate, then re-insert fresh data.
        // This avoids the skipDuplicates problem where old rows from a previous
        // partial run survive alongside new data.
        await prisma.commit.deleteMany({ where: { repositoryId } });
        await prisma.branch.deleteMany({ where: { repositoryId } });
        await prisma.file.deleteMany({ where: { repositoryId } });
        await prisma.contributor.deleteMany({ where: { repositoryId } });
        await prisma.language.deleteMany({ where: { repositoryId } });

        // Update README
        await prisma.repository.update({
          where: { id: repositoryId },
          data: {
            readmePath: readme?.path ?? "README.md",
            readmeText: readme?.text ?? "doesnt exist",
            readmeFetchedAt: new Date(),
          },
        });

        // Insert branches
        if (branches.length > 0) {
          await prisma.branch.createMany({
            data: branches.map((branch) => ({
              name: branch.name,
              isDefault: branch.isDefault,
              isProtected: branch.isProtected,
              commitCount: branch.commitCount,
              lastCommitAt: branch.lastCommitAt,
              repositoryId,
            })),
          });
        }

        // Insert commits + file changes in chunks
        if (commits.length > 0) {
          const commitChunkSize = 100;
          for (let i = 0; i < commits.length; i += commitChunkSize) {
            const chunk = commits.slice(i, i + commitChunkSize);

            await prisma.commit.createMany({
              data: chunk.map((commit) => ({
                hash: commit.hash,
                shortHash: commit.shortHash,
                message: commit.message,
                description: commit.description,
                authorName: commit.authorName,
                authorEmail: commit.authorEmail,
                committedAt: commit.committedAt,
                branch: commit.branch,
                parents: commit.parents || [],
                refs: commit.refs || [],
                tags: commit.tags || [],
                additions: commit.additions,
                deletions: commit.deletions,
                filesChanged: commit.filesChanged,
                repositoryId,
              })),
            });

            const insertedCommits = await prisma.commit.findMany({
              where: {
                repositoryId,
                hash: { in: chunk.map((c: { hash: string }) => c.hash) },
              },
              select: { id: true, hash: true },
            });
            const commitIdByHash = new Map(
              insertedCommits.map((c: { hash: string; id: number }) => [c.hash, c.id]),
            );

            const fileChanges = chunk.flatMap(
              (commit: {
                hash: string;
                fileChanges: Array<{
                  path: string;
                  additions: number;
                  deletions: number;
                  changeType: "added" | "modified" | "deleted";
                }>;
              }) => {
                const commitId = commitIdByHash.get(commit.hash);
                if (!commitId || commit.fileChanges.length === 0) return [];
                return commit.fileChanges.map((change) => ({
                  path: change.path,
                  additions: change.additions,
                  deletions: change.deletions,
                  changeType: change.changeType.toUpperCase() as FileChangeType,
                  commitId,
                }));
              },
            );

            if (fileChanges.length > 0) {
              await prisma.fileChange.createMany({ data: fileChanges });
            }
          }
        }

        // Insert files in chunks
        if (files.length > 0) {
          const chunkSize = 500;
          for (let i = 0; i < files.length; i += chunkSize) {
            const chunk = files.slice(i, i + chunkSize);
            await prisma.file.createMany({
              data: chunk.map((file) => ({
                path: file.path,
                name: file.name,
                extension: file.extension,
                size: file.size,
                lines: file.lines,
                language: file.language,
                repositoryId,
              })),
            });
          }
        }

        // Insert contributors
        if (contributors.length > 0) {
          const totalContributions = contributors.reduce(
            (sum: number, c: { commits: number }) => sum + c.commits, 0,
          );
          await prisma.contributor.createMany({
            data: contributors.map((contributor: { commits: number; name: string; email: string; additions: number; deletions: number; firstCommit: Date; lastCommit: Date }) => {
              const percentage =
                totalContributions > 0
                  ? (contributor.commits / totalContributions) * 100
                  : 0;
              return {
                name: contributor.name,
                email: contributor.email,
                commits: contributor.commits,
                additions: contributor.additions,
                deletions: contributor.deletions,
                percentage,
                firstCommit: contributor.firstCommit,
                lastCommit: contributor.lastCommit,
                repositoryId,
              };
            }),
          });
        }

        // Process and insert languages
        const ignoredLanguages = ["JSON", "YAML", "Markdown", "TOML", "CSV"];
        const filteredLanguages = languages.filter(
          (lang: { name: string }) => !ignoredLanguages.includes(lang.name),
        );

        if (filteredLanguages.length > 0) {
          const totalBytes = filteredLanguages.reduce(
            (sum: number, lang: { bytes: number }) => sum + lang.bytes,
            0,
          );
          const rawPercentages = filteredLanguages.map(
            (lang: { bytes: number }) => (totalBytes > 0 ? (lang.bytes / totalBytes) * 100 : 0),
          );

          const roundedPercentages = rawPercentages.map(
            (p: number) => Math.round(p * 100) / 100,
          );

          const pctSum = roundedPercentages.reduce(
            (acc: number, val: number) => acc + val, 0,
          );
          if (pctSum > 0 && pctSum !== 100 && roundedPercentages.length > 0) {
            const diff = 100 - pctSum;
            const maxIndex = roundedPercentages.indexOf(
              Math.max(...roundedPercentages),
            );
            if (maxIndex !== -1) {
              roundedPercentages[maxIndex] =
                Math.round((roundedPercentages[maxIndex] + diff) * 100) / 100;
            }
          }

          const languagesWithAdjustedPercentage = filteredLanguages.map(
            (lang: { name: string; bytes: number; lines: number }, index: number) => ({
              name: lang.name,
              bytes: lang.bytes,
              lines: lang.lines,
              percentage: roundedPercentages[index],
            }),
          );

          await prisma.language.createMany({
            data: languagesWithAdjustedPercentage.map(
              (language: { name: string; percentage: number; bytes: number; lines: number }) => ({
                name: language.name,
                percentage: language.percentage,
                bytes: language.bytes,
                lines: language.lines,
                repositoryId,
              }),
            ),
          });
        }

        // Final status update
        await prisma.repository.update({
          where: { id: repositoryId },
          data: {
            status: "completed",
            lastAnalyzedAt: new Date(),
            defaultBranch,
            size: size,
          },
        });
      });
      
      // Save repository knowledge if found
      try {
        await repositoryKnowledgeService.upsertKnowledge(repositoryId, parsedKnowledge);
      } catch (err) {
        console.warn(`Failed to save repository knowledge for ${repositoryId}:`, err);
      }

      // Cache invalidation (outside transaction — best-effort, non-critical)
      try {
        const headCommit = await prisma.commit.findFirst({
          where: { repositoryId, branch: defaultBranch },
          orderBy: { committedAt: "desc" },
          select: { hash: true },
        });

        if (headCommit?.hash) {
          await invalidateGeminiAnalysisCacheForRepository(repositoryId, headCommit.hash);
        }
      } catch (error) {
        console.warn("Gemini cache invalidation failed:", error);
      }

      await report({ progressPercent: 100, progressMessage: "Completed" });

    } catch (error: any) {
      console.error(`Error analyzing repository ${repositoryId}:`, error);
      await prisma.repository.update({
        where: { id: repositoryId },
        data: { status: "failed" },
      });
      await report({ progressMessage: "Analysis failed. Please try again." });
      throw error;
    } finally {
      clearTimeout(timeoutId);
      // Cleanup cloned repository
      if (gitService) {
        await gitService.cleanup();
      } else {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null);
      }
    }
  }

  /**
   * Generates architecture map iteratively for massive repositories
   */
  async generateArchitectureIteratively(
    repositoryId: number,
    userId: number,
    opts?: { onProgress?: RepositoryAnalysisProgressReporter }
  ) {
    const repository = await prisma.repository.findFirst({
      where: { id: repositoryId, userId },
      include: {
        files: true,
        commits: { take: 50 },
        languages: { take: 20 },
        contributors: { take: 20 }
      }
    });

    if (!repository) {
      throw new Error("Repository not found");
    }

    const report = async (update: RepositoryAnalysisProgress) => {
      if (opts?.onProgress) {
        try { await opts.onProgress(update); } catch {}
      }
    };

    await report({ progressPercent: 10, progressMessage: "Grouping files into chunks..." });

    const flatFiles = repository.files || [];
    const chunkSize = 100;
    const chunks: Array<typeof flatFiles> = [];

    for (let i = 0; i < flatFiles.length; i += chunkSize) {
      chunks.push(flatFiles.slice(i, i + chunkSize));
    }

    if (chunks.length === 0) {
      await report({ progressPercent: 100, progressMessage: "No files to analyze." });
      return;
    }

    const geminiService = getGeminiService();
    let completedChunks = 0;
    const totalChunks = chunks.length;

    // Clear previous chunks for this repo
    await prisma.repositoryArchitectureChunk.deleteMany({
      where: { repositoryId }
    });

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      await report({ 
        progressPercent: 10 + Math.floor((completedChunks / totalChunks) * 60), 
        progressMessage: `Analyzing chunk ${i + 1} of ${totalChunks}...` 
      });

      let aiResponse = await geminiService.analyzeRepository({
        repositoryId,
        type: "architecture-chunk",
        context: {
          fileTree: chunk.map((f: any) => f.path).join("\n"),
        }
      });

      aiResponse = aiResponse
        .replace(/^[\s\n]*```(?:markdown|md)?[\s\n]*/i, "")
        .replace(/[\s\n]*```[\s\n]*$/i, "")
        .trim();

      await prisma.repositoryArchitectureChunk.create({
        data: {
          repositoryId,
          chunkPath: `chunk-${i}`,
          summary: aiResponse
        }
      });

      completedChunks++;
    }

    await report({ progressPercent: 70, progressMessage: "Synthesizing final architecture map..." });

    const savedChunks = await prisma.repositoryArchitectureChunk.findMany({
      where: { repositoryId },
      orderBy: { id: "asc" }
    });

    const combinedSummaries = savedChunks.map(c => `Chunk ${c.chunkPath}:\n${c.summary}`).join("\n\n---\n\n");

    let finalAiResponse = await geminiService.analyzeRepository({
      repositoryId,
      type: "architecture-document",
      context: {
        fileTree: `Combined Intermediate Summaries:\n\n${combinedSummaries}`,
        commits: repository.commits,
        languages: repository.languages,
        contributors: repository.contributors
      }
    });

    finalAiResponse = finalAiResponse
      .replace(/^[\s\n]*```(?:markdown|md)?[\s\n]*/i, "")
      .replace(/[\s\n]*```[\s\n]*$/i, "")
      .trim();

    await prisma.repositoryKnowledge.upsert({
      where: { repositoryId },
      create: {
        repositoryId,
        projectDescription: finalAiResponse
      },
      update: {
        projectDescription: finalAiResponse
      }
    });

    await report({ progressPercent: 100, progressMessage: "Completed architecture generation." });
  }

  /**
   * Get repository with all related data
   */
  async getRepository(id: number, userId: number) {
    const repository = await prisma.repository.findFirst({
      where: {
        id: Number(id),
        userId: Number(userId),
      },
      include: {
        branches: {
          orderBy: { isDefault: "desc" },
        },
        commits: {
          orderBy: { committedAt: "desc" },
          take: 100,
          include: {
            fileChanges: true,
          },
        },
        contributors: {
          orderBy: { commits: "desc" },
        },
        languages: {
          orderBy: { percentage: "desc" },
        },
        files: {
          orderBy: { path: "asc" },
          take: 500,
        },
        knowledge: true,
      },
    });

    return repository;
  }

  async listRepositories(userId: number, limit: number = 10, cursor?: number) {
    const repositories = await prisma.repository.findMany({
      where: { userId },
      take: limit + 1, // Fetch one extra to determine if hasMore
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        _count: {
          select: {
            commits: true,
            contributors: true,
            files: true,
            branches: true,
          },
        },
        languages: {
          orderBy: { percentage: "desc" },
          take: 3,
        },
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" } // Deterministic tie-breaker
      ],
    });

    let nextCursor: number | undefined = undefined;
    if (repositories.length > limit) {
      const nextItem = repositories.pop();
      nextCursor = nextItem?.id;
    }

    return {
      data: repositories,
      nextCursor,
      hasMore: nextCursor !== undefined,
    };
  }

  /**
   * Delete a repository and all its data
   */
  async deleteRepository(id: number, userId: number) {
    const result = await prisma.repository.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      throw new Error("Repository not found");
    }

    return { success: true };
  }
  //Explicitly set the status of a repository
  async setRepositoryStatus(
    repositoryId: number,
    status: "pending" | "analyzing" | "completed" | "failed",
  ): Promise<void> {
    await prisma.repository.update({
      where: { id: repositoryId },
      data: { status },
    });
  }

  /**
   * Get repository statistics
   */
  async getRepositoryStats(id: number, userId: number) {
    const repository = await prisma.repository.findFirst({
      where: { id, userId },
    });

    if (!repository) {
      throw new Error("Repository not found");
    }

    // Batch DB queries to avoid connection pool exhaustion under concurrent load.
    // Counts are cheap and fast; run them together, then fetch the heavier query.
    const [totalCommits, totalContributors, totalFiles, totalBranches] =
      await Promise.all([
        prisma.commit.count({ where: { repositoryId: id } }),
        prisma.contributor.count({ where: { repositoryId: id } }),
        prisma.file.count({ where: { repositoryId: id } }),
        prisma.branch.count({ where: { repositoryId: id } }),
      ]);

    const recentActivity = await prisma.commit.findMany({
      where: { repositoryId: id },
      orderBy: { committedAt: "desc" },
      take: 10,
      select: {
        shortHash: true,
        message: true,
        authorName: true,
        committedAt: true,
      },
    });

    return {
      totalCommits,
      totalContributors,
      totalFiles,
      totalBranches,
      recentActivity,
      status: repository.status,
      lastAnalyzedAt: repository.lastAnalyzedAt,
    };
  }

  /**
   * Get aggregate file-level statistics across the full repository history.
   */
  async getFileStats(
    repositoryId: number,
    userId: number,
    paths: string[],
  ) {
    const repository = await prisma.repository.findFirst({
      where: { id: repositoryId, userId },
      select: { id: true },
    });

    if (!repository) {
      throw new Error("Repository not found");
    }

    const uniquePaths = Array.from(
      new Set(paths.map((path) => path.trim()).filter(Boolean)),
    );

    if (uniquePaths.length === 0) {
      return [];
    }

    const stats = await prisma.fileChange.groupBy({
      by: ["path"],
      where: {
        path: { in: uniquePaths },
        commit: { repositoryId },
      },
      _count: { id: true },
      _sum: {
        additions: true,
        deletions: true,
      },
    });

    const statsByPath = new Map(
      stats.map((stat) => [
        stat.path,
        {
          path: stat.path,
          commitCount: stat._count.id,
          additions: stat._sum.additions ?? 0,
          deletions: stat._sum.deletions ?? 0,
        },
      ]),
    );

    return uniquePaths.map(
      (path) =>
        statsByPath.get(path) ?? {
          path,
          commitCount: 0,
          additions: 0,
          deletions: 0,
        },
    );
  }
}

export const repositoryService = new RepositoryService();
