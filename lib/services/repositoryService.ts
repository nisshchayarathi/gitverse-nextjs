import prisma from "../prisma";
import { GitService } from "./gitService";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import * as fs from "fs/promises";
import { invalidateGeminiAnalysisCacheForRepository } from "./geminiAnalysisCacheService";
import { FileChangeType } from "@prisma/client";

function yieldIfHighMemory(threshold = 0.7): Promise<void> {
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
      // For README we don't need all branches; keep it lightweight.
      gitService = await GitService.cloneRepository(repository.url, tempDir, {
        depth: 1,
        noSingleBranch: false,
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
      },
    });

    return repository;
  }

  /**
   * Analyze a repository and store all data
   */
  async analyzeRepository(
    repositoryId: number,
    opts?: { onProgress?: RepositoryAnalysisProgressReporter; scope?: string },
  ) {
    const repository = await prisma.repository.findUnique({
      where: { id: repositoryId },
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

      // Clone repository
      await report({
        progressPercent: 5,
        progressMessage: "Cloning repository...",
      });
      gitService = await GitService.cloneRepository(repository.url, tempDir, {
        signal,
        onProgress: (pct, msg) => {
          const analysisPct = 5 + Math.round((pct / 100) * 3);
          report({ progressPercent: Math.min(8, analysisPct), progressMessage: msg });
        },
      });

      checkAborted();

      // Capture README first, then size + branches in parallel.
      await report({ progressPercent: 8, progressMessage: "Reading README" });
      const scopedReadmePath = repository.targetDirectory
        ? path.join(tempDir, repository.targetDirectory)
        : null;
      const readme =
        (scopedReadmePath
          ? await this.tryReadmeFromRepoPath(scopedReadmePath)
          : null) ?? (await this.tryReadmeFromRepoPath(tempDir));
      await prisma.repository.update({
        where: { id: repositoryId },
        data: {
          readmePath: readme?.path ?? "README.md",
          readmeText: readme?.text ?? "doesnt exist",
          readmeFetchedAt: new Date(),
        },
      });

      checkAborted();

      // Get repository size and branches.
      await report({
        progressPercent: 10,
        progressMessage: "Calculating repository size...",
      });
      const [size, branches] = await Promise.all([
        gitService.getRepositorySize(),
        gitService.getBranches(),
      ]);

      checkAborted();

      // Analyze branches
      await report({
        progressPercent: 15,
        progressMessage: "Analyzing branches...",
      });
      const defaultBranch = branches.find((b) => b.isDefault)?.name || "main";

      await prisma.branch.createMany({
        data: branches.map((branch) => ({
          name: branch.name,
          isDefault: branch.isDefault,
          isProtected: branch.isProtected,
          commitCount: branch.commitCount,
          lastCommitAt: branch.lastCommitAt,
          repositoryId,
        })),
        skipDuplicates: true,
      });

      checkAborted();

      // Analyze commits from all branches
      await report({
        progressPercent: 25,
        progressMessage: "Fetching commit history...",
      });
      const commits = await gitService.getCommits("--all", 1000);

      // IMPORTANT: Do not load *all* existing commits for the repo.
      // On large repos this can be huge and cause OOM/timeouts. We only need to
      // know which of the commits we just fetched already exist.
      const existingCommits =
        commits.length > 0
          ? await prisma.commit.findMany({
              where: {
                repositoryId,
                hash: {
                  in: commits.map((commit: { hash: string }) => commit.hash),
                },
              },
              select: { hash: true },
            })
          : [];
      const existingHashes = new Set(existingCommits.map((c) => c.hash));

      // Filter out commits that already exist
      const newCommits = commits.filter(
        (commit: { hash: string }) => !existingHashes.has(commit.hash),
      );


      let insertedCount = 0;
      let failedCount = 0;

      const totalNewCommits = Math.max(1, newCommits.length);
      const commitChunkSize = 100;

      for (let i = 0; i < newCommits.length; i += commitChunkSize) {
        checkAborted();
        const chunk = newCommits.slice(i, i + commitChunkSize);

        try {
          const inserted = await prisma.commit.createMany({
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
            skipDuplicates: true,
          });

          insertedCount += inserted.count;

          const insertedCommits =
            chunk.length > 0
              ? await prisma.commit.findMany({
                  where: {
                    repositoryId,
                    hash: {
                      in: chunk.map((commit: { hash: string }) => commit.hash),
                    },
                  },
                  select: { id: true, hash: true },
                })
              : [];
          const commitIdByHash = new Map(
            insertedCommits.map((commit: { hash: string; id: number }) => [
              commit.hash,
              commit.id,
            ]),
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
            await prisma.fileChange.createMany({
              data: fileChanges,
              skipDuplicates: true,
            });
          }

          const pct = 25 + Math.round((Math.min(i + chunk.length, newCommits.length) / totalNewCommits) * 35);
          await report({
            progressPercent: Math.min(60, pct),
            progressMessage: `Processing commits (${Math.min(i + chunk.length, newCommits.length)}/${newCommits.length})...`,
          });
        } catch (error: any) {
          failedCount += chunk.length;
          console.error(`Failed to insert commit chunk starting at ${i}:`, error.message);
        }

        await yieldIfHighMemory();
      }


      checkAborted();

      // Analyze files
      await report({ progressPercent: 65, progressMessage: "Scanning files" });
      const files = await gitService.getFileTree(opts?.scope);

      // Avoid querying existing file paths (can be huge). Just rely on
      // `skipDuplicates` with the unique constraint (repositoryId, path).
      if (files.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < files.length; i += chunkSize) {
          checkAborted();
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
            skipDuplicates: true,
          });

          const insertedSoFar = Math.min(files.length, i + chunk.length);
          await report({
            progressPercent:
              65 + Math.round((insertedSoFar / files.length) * 10),
            progressMessage: `Indexing files (${insertedSoFar}/${files.length})...`,
          });
        }
       
      } else {
      }

      checkAborted();

      // Analyze contributors and languages in parallel; both are independent after file scan.
      await report({
        progressPercent: 80,
        progressMessage: "Analyzing contributor activity...",
      });
      await report({
        progressPercent: 90,
        progressMessage: "Detecting programming languages...",
      });

      const [contributors, languages] = await Promise.all([
        gitService.getContributors(),
        gitService.detectLanguages({
          targetDirectory: repository.targetDirectory ?? null,
        }),
      ]);

      checkAborted();

      const totalContributions = contributors.reduce(
        (sum, c) => sum + c.commits,
        0,
      );

      if (contributors.length > 0) {
        await prisma.contributor.createMany({
          data: contributors.map((contributor) => {
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
          skipDuplicates: true,
        });
      }

      // Detect languages
      console.log(`Detecting languages for repository ${repositoryId}`);
      await report({
        progressPercent: 90,
        progressMessage: "Detecting languages",
      });
      const languages = await gitService.detectLanguages(opts?.scope);
      // Languages to ignore (config/data formats, not actual code)
      const ignoredLanguages = ["JSON", "YAML", "Markdown", "TOML", "CSV"];

      // Clean up existing languages before inserting fresh data,
      // otherwise re-analysis would leave stale records and skip
      // updates on metrics that may have changed.
      try {
        await prisma.language.deleteMany({
          where: { repositoryId },
        });
      } catch (e: any) {
        console.error(
          `Failed to clean up languages for repository ${repositoryId}:`,
          e.message,
        );
      }

      if (languagesWithAdjustedPercentage.length > 0) {
        try {
          await prisma.language.createMany({
            data: languagesWithAdjustedPercentage.map((language) => ({
              name: language.name,
              percentage: language.percentage,
              bytes: language.bytes,
              lines: language.lines,
              repositoryId,
            })),
          });
        } catch (e: any) {
          console.error(
            `Failed to insert languages for repository ${repositoryId}:`,
            e.message,
          );
        }
      // Filter out ignored languages
      const filteredLanguages = languages.filter(
        (lang) => !ignoredLanguages.includes(lang.name),
      );

      // Recalculate percentages based on remaining languages only
      const totalBytes = filteredLanguages.reduce(
        (sum, lang) => sum + lang.bytes,
        0,
      );
      const rawPercentages = filteredLanguages.map((lang) =>
        totalBytes > 0 ? (lang.bytes / totalBytes) * 100 : 0,
      );

      // Round to 2 decimal places
      const roundedPercentages = rawPercentages.map(
        (p) => Math.round(p * 100) / 100,
      );

      // Adjust to ensure sum is exactly 100%
      const sum = roundedPercentages.reduce((acc, val) => acc + val, 0);
      if (sum > 0 && sum !== 100 && roundedPercentages.length > 0) {
        const diff = 100 - sum;
        // Add difference to the largest percentage
        const maxIndex = roundedPercentages.indexOf(
          Math.max(...roundedPercentages),
        );
        if (maxIndex !== -1) {
          roundedPercentages[maxIndex] =
            Math.round((roundedPercentages[maxIndex] + diff) * 100) / 100;
        }
      }

      const languagesWithAdjustedPercentage = filteredLanguages.map(
        (lang, index) => ({
          ...lang,
          percentage: roundedPercentages[index],
        }),
      );

      if (languagesWithAdjustedPercentage.length > 0) {
        await prisma.language.createMany({
          data: languagesWithAdjustedPercentage.map((language) => ({
            name: language.name,
            percentage: language.percentage,
            bytes: language.bytes,
            lines: language.lines,
            repositoryId,
          })),
          skipDuplicates: true,
        });
      }

      // Update repository with final data
      await prisma.repository.update({
        where: { id: repositoryId },
        data: {
          status: "completed",
          lastAnalyzedAt: new Date(),
          defaultBranch,
          size: size,
        },
      });

      // Cache invalidation: keep only entries for the current HEAD commit on the default branch.
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
   * Get repository with all related data
   */
  async getRepository(id: number, userId: number) {
    const repository = await prisma.repository.findFirst({
      where: {
        id,
        userId,
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
      },
    });

    return repository;
  }

  /**
   * List all repositories for a user
   */
  async listRepositories(userId: number) {
    const repositories = await prisma.repository.findMany({
      where: { userId },
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
      orderBy: { createdAt: "desc" },
    });

    return repositories;
  }

  /**
   * Delete a repository and all its data
   */
  async deleteRepository(id: number, userId: number) {
    const repository = await prisma.repository.findFirst({
      where: { id, userId },
    });

    if (!repository) {
      throw new Error("Repository not found");
    }

    await prisma.repository.delete({
      where: { id },
    });

    return { success: true };
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

    const [
      totalCommits,
      totalContributors,
      totalFiles,
      totalBranches,
      recentActivity,
    ] = await Promise.all([
      prisma.commit.count({ where: { repositoryId: id } }),
      prisma.contributor.count({ where: { repositoryId: id } }),
      prisma.file.count({ where: { repositoryId: id } }),
      prisma.branch.count({ where: { repositoryId: id } }),
      prisma.commit.findMany({
        where: { repositoryId: id },
        orderBy: { committedAt: "desc" },
        take: 10,
        select: {
          shortHash: true,
          message: true,
          authorName: true,
          committedAt: true,
        },
      }),
    ]);

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
