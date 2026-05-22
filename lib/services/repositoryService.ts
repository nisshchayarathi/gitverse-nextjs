import prisma from "../prisma";
import { GitService } from "./gitService";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import * as fs from "fs/promises";

export interface AnalyzeRepositoryInput {
  name: string;
  url: string;
  description?: string;
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

class AnalysisProgressTracker {
  constructor(
    private repositoryId: number,
    private reporter?: RepositoryAnalysisProgressReporter
  ) {}

  async update(percent: number, message: string, details?: unknown) {
    const safePercent = Math.max(0, Math.min(100, Math.round(percent || 0)));
    console.log(`[Repo ${this.repositoryId}] ${safePercent}% - ${message}`);
    
    if (!this.reporter) return;
    try {
      await this.reporter({
        progressPercent: safePercent,
        progressMessage: message,
        progressDetails: details,
      });
    } catch {
      // Progress reporting must never break analysis
    }
  }

  async progressSubTask(
    startPercent: number,
    endPercent: number,
    current: number,
    total: number,
    message: string
  ) {
    if (total <= 0) {
      await this.update(endPercent, `${message} (Completed)`);
      return;
    }
    const range = endPercent - startPercent;
    const ratio = Math.max(0, Math.min(1, current / total));
    const currentPercent = startPercent + (range * ratio);
    await this.update(currentPercent, message);
  }

  async fail(error: Error | unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Repo ${this.repositoryId}] Analysis Failed: ${msg}`);
    if (this.reporter) {
      try {
        await this.reporter({ progressMessage: `Failed: ${msg}` });
      } catch {}
    }
  }
}

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
      select: { id: true, url: true },
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

      const readme = await this.tryReadmeFromRepoPath(tempDir);

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
      },
    });

    if (existingRepository) {
      console.log(`Repository already exists: ${existingRepository.id}`);

      return existingRepository;
    }

    const repository = await prisma.repository.create({
      data: {
        name: input.name,
        url: input.url,
        description: input.description,
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
    opts?: { onProgress?: RepositoryAnalysisProgressReporter },
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

    const tracker = new AnalysisProgressTracker(repositoryId, opts?.onProgress);
    await tracker.update(1, "Starting analysis");

    // Create temporary directory for cloning
    const tempDir = path.join(
      os.tmpdir(),
      "gitverse",
      `repo-${repositoryId}-${crypto.randomBytes(8).toString("hex")}`,
    );

    let gitService: GitService | null = null;

    try {
      // Clone repository
      await tracker.update(5, `Cloning repository ${repository.url}`);
      gitService = await GitService.cloneRepository(repository.url, tempDir);

      // Capture README early (best-effort)
      await tracker.update(8, "Reading README");
      const readme = await this.tryReadmeFromRepoPath(tempDir);
      await prisma.repository.update({
        where: { id: repositoryId },
        data: {
          readmePath: readme?.path ?? "README.md",
          readmeText: readme?.text ?? "doesnt exist",
          readmeFetchedAt: new Date(),
        },
      });

      // Get repository size
      await tracker.update(10, "Calculating size");
      const size = await gitService.getRepositorySize();

      // Analyze branches
      await tracker.update(15, "Analyzing branches");
      const branches = await gitService.getBranches();
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

      // Analyze commits from all branches
      await tracker.update(25, "Reading commit history");
      const commits = await gitService.getCommits("--all", 1000);
      console.log(`Total commits fetched from git: ${commits.length}`);

      // IMPORTANT: Do not load *all* existing commits for the repo.
      // On large repos this can be huge and cause OOM/timeouts. We only need to
      // know which of the commits we just fetched already exist.
      const existingCommits =
        commits.length > 0
          ? await prisma.commit.findMany({
            where: {
              repositoryId,
              hash: { in: commits.map((c) => c.hash) },
            },
            select: { hash: true },
          })
          : [];
      const existingHashes = new Set(existingCommits.map((c) => c.hash));

      // Filter out commits that already exist
      const newCommits = commits.filter(
        (commit) => !existingHashes.has(commit.hash),
      );

      console.log(
        `Found ${commits.length} commits, ${newCommits.length} are new, ${existingCommits.length} already exist`,
      );

      let insertedCount = 0;
      let failedCount = 0;

      const totalNewCommits = newCommits.length;
      let lastCommitProgressUpdateAt = Date.now();

      if (totalNewCommits === 0) {
        await tracker.update(60, "Storing commits (Up to date)");
      }

      for (const commit of newCommits) {
        try {
          const createdCommit = await prisma.commit.create({
            data: {
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
            },
          });

          insertedCount++;

          // Periodically report progress (every ~2s)
          if (Date.now() - lastCommitProgressUpdateAt > 2000) {
            await tracker.progressSubTask(25, 60, insertedCount, totalNewCommits, `Storing commits (${insertedCount}/${totalNewCommits})`);
            lastCommitProgressUpdateAt = Date.now();
          }

          // Store file changes
          if (commit.fileChanges.length > 0) {
            await prisma.fileChange.createMany({
              data: commit.fileChanges.map((change) => ({
                path: change.path,
                additions: change.additions,
                deletions: change.deletions,
                changeType: change.changeType,
                commitId: createdCommit.id,
              })),
              skipDuplicates: true,
            });
          }
        } catch (error: any) {
          failedCount++;
          console.error(
            `Failed to insert commit ${commit.hash}:`,
            error.message,
          );
          // Continue with next commit
        }
      }

      console.log(
        `Commit insertion complete: ${insertedCount} inserted, ${failedCount} failed`,
      );

      // Analyze files
      await tracker.update(65, "Scanning files");
      const files = await gitService.getFileTree();

      // Avoid querying existing file paths (can be huge). Just rely on
      // `skipDuplicates` with the unique constraint (repositoryId, path).
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
            skipDuplicates: true,
          });

          const insertedSoFar = Math.min(files.length, i + chunk.length);
          await tracker.progressSubTask(65, 75, insertedSoFar, files.length, `Storing files (${insertedSoFar}/${files.length})`);
        }
        console.log(
          `File scan complete: processed ${files.length} paths for repository ${repositoryId}`,
        );
      } else {
        await tracker.update(75, "Storing files (Skipped - no files found)");
      }

      // Analyze contributors
      await tracker.update(80, "Analyzing contributors");
      const contributors = await gitService.getContributors();
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
      await tracker.update(90, "Detecting languages");
      const languages = await gitService.detectLanguages();

      // Languages to ignore (config/data formats, not actual code)
      const ignoredLanguages = ["JSON", "YAML", "Markdown", "TOML", "CSV"];

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
      if (sum > 0 && sum !== 100) {
        const diff = 100 - sum;
        // Add difference to the largest percentage
        const maxIndex = roundedPercentages.indexOf(
          Math.max(...roundedPercentages),
        );
        roundedPercentages[maxIndex] =
          Math.round((roundedPercentages[maxIndex] + diff) * 100) / 100;
      }

      const languagesWithAdjustedPercentage = filteredLanguages.map(
        (lang, index) => ({
          ...lang,
          percentage: roundedPercentages[index],
        }),
      );

      await prisma.$transaction(async (tx) => {
        // Always clear stale languages even when result set is empty
        await tx.language.deleteMany({
          where: { repositoryId }
        });

        if (languagesWithAdjustedPercentage.length > 0) {
          const validLanguages = languagesWithAdjustedPercentage
            .map((language) => {
              const trimmedName = language.name.trim();
              if (!trimmedName) return null;
              
              return {
                name: trimmedName,
                percentage: language.percentage,
                bytes: language.bytes,
                lines: language.lines,
                repositoryId,
              };
            })
            .filter((lang): lang is NonNullable<typeof lang> => lang !== null);

          if (validLanguages.length > 0) {
            await tx.language.createMany({
              data: validLanguages,
              skipDuplicates: true,
            });
          }
        }
      });

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

      await tracker.update(100, "Completed");
    } catch (error: any) {
      await prisma.repository.update({
        where: { id: repositoryId },
        data: { status: "failed" },
      });
      await tracker.fail(error);
      throw error;
    } finally {
      // Cleanup cloned repository
      if (gitService) {
        await gitService.cleanup();
      }
    }
  }

  /**
   * Safely marks a repository as failed, preventing uncaught exceptions
   * if the database update fails.
   */
  async markRepositoryFailed(id: number, reason?: string) {
    try {
      await prisma.repository.update({
        where: { id },
        data: { status: "failed" },
      });
      if (reason) {
        console.log(`Repository ${id} marked as failed. Reason: ${reason}`);
      }
    } catch (error) {
      console.error(`Safeguard: Failed to update repository ${id} status to 'failed'`, error instanceof Error ? error.message : String(error));
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

    // Delete related analysis jobs and the repository in a transaction
    // to ensure no orphaned rows remain if the process is interrupted.
    await prisma.$transaction([
      prisma.analysisJob.deleteMany({
        where: { repositoryId: id },
      }),
      prisma.repository.delete({
        where: { id },
      }),
    ]);

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
}

export const repositoryService = new RepositoryService();
