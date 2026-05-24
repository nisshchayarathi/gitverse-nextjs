"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.repositoryService = exports.RepositoryService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const gitService_1 = require("./gitService");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs/promises"));
function yieldIfHighMemory(threshold = 0.7) {
    const usage = process.memoryUsage();
    if (usage.heapUsed / usage.heapTotal > threshold) {
        return new Promise((resolve) => setImmediate(resolve));
    }
    return Promise.resolve();
}
class RepositoryService {
    async tryReadmeFromRepoPath(repoPath) {
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
                if (!actual)
                    continue;
                const fullPath = path.join(repoPath, actual);
                const content = await fs.readFile(fullPath, "utf8");
                const trimmed = content.trim();
                if (!trimmed)
                    return null;
                // Prevent huge README payloads from bloating DB / responses.
                const maxChars = 200_000;
                const safeText = trimmed.length > maxChars ? trimmed.slice(0, maxChars) : trimmed;
                return { path: actual, text: safeText };
            }
            return null;
        }
        catch {
            return null;
        }
    }
    async fetchAndStoreReadme(repositoryId, userId) {
        const repository = await prisma_1.default.repository.findFirst({
            where: { id: repositoryId, userId },
            select: { id: true, url: true },
        });
        if (!repository) {
            throw new Error("Repository not found");
        }
        const tempDir = path.join(os.tmpdir(), "gitverse", `readme-${repositoryId}-${crypto.randomBytes(8).toString("hex")}`);
        let gitService = null;
        try {
            // For README we don't need all branches; keep it lightweight.
            gitService = await gitService_1.GitService.cloneRepository(repository.url, tempDir, {
                depth: 1,
                noSingleBranch: false,
            });
            const readme = await this.tryReadmeFromRepoPath(tempDir);
            const updated = await prisma_1.default.repository.update({
                where: { id: repositoryId },
                data: {
                    readmePath: readme?.path ?? "README.md",
                    readmeText: readme?.text ?? "doesnt exist",
                    readmeFetchedAt: new Date(),
                },
            });
            return updated;
        }
        finally {
            if (gitService) {
                await gitService.cleanup();
            }
            else {
                await fs
                    .rm(tempDir, { recursive: true, force: true })
                    .catch(() => null);
            }
        }
    }
    /**
     * Create a new repository record or return existing one
     */
    async createRepository(input) {
        // Check if repository with same URL already exists for this user
        const existingRepository = await prisma_1.default.repository.findFirst({
            where: {
                url: input.url,
                userId: input.userId,
            },
        });
        if (existingRepository) {
            console.log(`Repository already exists: ${existingRepository.id}`);
            return existingRepository;
        }
        const repository = await prisma_1.default.repository.create({
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
    async analyzeRepository(repositoryId, opts) {
        const repository = await prisma_1.default.repository.findUnique({
            where: { id: repositoryId },
        });
        if (!repository) {
            throw new Error("Repository not found");
        }
        // Update status to analyzing
        await prisma_1.default.repository.update({
            where: { id: repositoryId },
            data: { status: "analyzing" },
        });
        const report = async (update) => {
            if (!opts?.onProgress)
                return;
            try {
                await opts.onProgress(update);
            }
            catch {
                // Progress reporting must never break analysis.
            }
        };
        await report({ progressPercent: 1, progressMessage: "Starting" });
        // Create temporary directory for cloning
        const tempDir = path.join(os.tmpdir(), "gitverse", `repo-${repositoryId}-${crypto.randomBytes(8).toString("hex")}`);
        let gitService = null;
        try {
            // Clone repository
            console.log(`Cloning repository ${repository.url} to ${tempDir}`);
            await report({
                progressPercent: 5,
                progressMessage: "Cloning repository",
            });
            gitService = await gitService_1.GitService.cloneRepository(repository.url, tempDir, {
                onProgress: (pct, msg) => {
                    const analysisPct = 5 + Math.round((pct / 100) * 3);
                    report({ progressPercent: Math.min(8, analysisPct), progressMessage: msg });
                },
            });
            // Capture README first, then size + branches in parallel.
            await report({ progressPercent: 8, progressMessage: "Reading README" });
            const readme = await this.tryReadmeFromRepoPath(tempDir);
            await prisma_1.default.repository.update({
                where: { id: repositoryId },
                data: {
                    readmePath: readme?.path ?? "README.md",
                    readmeText: readme?.text ?? "doesnt exist",
                    readmeFetchedAt: new Date(),
                },
            });
            // Get repository size and branches.
            await report({
                progressPercent: 10,
                progressMessage: "Calculating size",
            });
            const [size, branches] = await Promise.all([
                gitService.getRepositorySize(),
                gitService.getBranches(),
            ]);
            // Analyze branches
            console.log(`Analyzing branches for repository ${repositoryId}`);
            await report({
                progressPercent: 15,
                progressMessage: "Analyzing branches",
            });
            const defaultBranch = branches.find((b) => b.isDefault)?.name || "main";
            await prisma_1.default.branch.createMany({
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
            console.log(`Analyzing commits for repository ${repositoryId}`);
            await report({
                progressPercent: 25,
                progressMessage: "Reading commit history",
            });
            const commits = await gitService.getCommits("--all", 1000);
            console.log(`Total commits fetched from git: ${commits.length}`);
            // IMPORTANT: Do not load *all* existing commits for the repo.
            // On large repos this can be huge and cause OOM/timeouts. We only need to
            // know which of the commits we just fetched already exist.
            const existingCommits = commits.length > 0
                ? await prisma_1.default.commit.findMany({
                    where: {
                        repositoryId,
                        hash: {
                            in: commits.map((commit) => commit.hash),
                        },
                    },
                    select: { hash: true },
                })
                : [];
            const existingHashes = new Set(existingCommits.map((c) => c.hash));
            // Filter out commits that already exist
            const newCommits = commits.filter((commit) => !existingHashes.has(commit.hash));
            console.log(`Found ${commits.length} commits, ${newCommits.length} are new, ${existingCommits.length} already exist`);
            let insertedCount = 0;
            let failedCount = 0;
            const totalNewCommits = Math.max(1, newCommits.length);
            const commitChunkSize = 100;
            for (let i = 0; i < newCommits.length; i += commitChunkSize) {
                const chunk = newCommits.slice(i, i + commitChunkSize);
                try {
                    const inserted = await prisma_1.default.commit.createMany({
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
                    const insertedCommits = chunk.length > 0
                        ? await prisma_1.default.commit.findMany({
                            where: {
                                repositoryId,
                                hash: {
                                    in: chunk.map((commit) => commit.hash),
                                },
                            },
                            select: { id: true, hash: true },
                        })
                        : [];
                    const commitIdByHash = new Map(insertedCommits.map((commit) => [
                        commit.hash,
                        commit.id,
                    ]));
                    const fileChanges = chunk.flatMap((commit) => {
                        const commitId = commitIdByHash.get(commit.hash);
                        if (!commitId || commit.fileChanges.length === 0)
                            return [];
                        return commit.fileChanges.map((change) => ({
                            path: change.path,
                            additions: change.additions,
                            deletions: change.deletions,
                            changeType: change.changeType,
                            commitId,
                        }));
                    });
                    if (fileChanges.length > 0) {
                        await prisma_1.default.fileChange.createMany({
                            data: fileChanges,
                            skipDuplicates: true,
                        });
                    }
                    const pct = 25 + Math.round((Math.min(i + chunk.length, newCommits.length) / totalNewCommits) * 35);
                    await report({
                        progressPercent: Math.min(60, pct),
                        progressMessage: `Storing commits (${Math.min(i + chunk.length, newCommits.length)}/${newCommits.length})`,
                    });
                }
                catch (error) {
                    failedCount += chunk.length;
                    console.error(`Failed to insert commit chunk starting at ${i}:`, error.message);
                }
                await yieldIfHighMemory();
            }
            console.log(`Commit insertion complete: ${insertedCount} inserted, ${failedCount} failed`);
            // Analyze files
            console.log(`Analyzing file tree for repository ${repositoryId}`);
            await report({ progressPercent: 65, progressMessage: "Scanning files" });
            const files = await gitService.getFileTree();
            // Avoid querying existing file paths (can be huge). Just rely on
            // `skipDuplicates` with the unique constraint (repositoryId, path).
            if (files.length > 0) {
                const chunkSize = 500;
                for (let i = 0; i < files.length; i += chunkSize) {
                    const chunk = files.slice(i, i + chunkSize);
                    await prisma_1.default.file.createMany({
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
                        progressPercent: 65 + Math.round((insertedSoFar / files.length) * 10),
                        progressMessage: `Storing files (${insertedSoFar}/${files.length})`,
                    });
                }
                console.log(`File scan complete: processed ${files.length} paths for repository ${repositoryId}`);
            }
            else {
                console.log(`No files found for repository ${repositoryId}`);
            }
            // Analyze contributors and languages in parallel; both are independent after file scan.
            console.log(`Analyzing contributors for repository ${repositoryId}`);
            await report({
                progressPercent: 80,
                progressMessage: "Analyzing contributors",
            });
            await report({
                progressPercent: 90,
                progressMessage: "Detecting languages",
            });
            const [contributors, languages] = await Promise.all([
                gitService.getContributors(),
                gitService.detectLanguages(),
            ]);
            const totalContributions = contributors.reduce((sum, c) => sum + c.commits, 0);
            if (contributors.length > 0) {
                await prisma_1.default.contributor.createMany({
                    data: contributors.map((contributor) => {
                        const percentage = totalContributions > 0
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
            // Languages to ignore (config/data formats, not actual code)
            const ignoredLanguages = ["JSON", "YAML", "Markdown", "TOML", "CSV"];
            // Filter out ignored languages
            const filteredLanguages = languages.filter((lang) => !ignoredLanguages.includes(lang.name));
            // Recalculate percentages based on remaining languages only
            const totalBytes = filteredLanguages.reduce((sum, lang) => sum + lang.bytes, 0);
            const rawPercentages = filteredLanguages.map((lang) => totalBytes > 0 ? (lang.bytes / totalBytes) * 100 : 0);
            // Round to 2 decimal places
            const roundedPercentages = rawPercentages.map((p) => Math.round(p * 100) / 100);
            // Adjust to ensure sum is exactly 100%
            const sum = roundedPercentages.reduce((acc, val) => acc + val, 0);
            if (sum > 0 && sum !== 100) {
                const diff = 100 - sum;
                // Add difference to the largest percentage
                const maxIndex = roundedPercentages.indexOf(Math.max(...roundedPercentages));
                roundedPercentages[maxIndex] =
                    Math.round((roundedPercentages[maxIndex] + diff) * 100) / 100;
            }
            const languagesWithAdjustedPercentage = filteredLanguages.map((lang, index) => ({
                ...lang,
                percentage: roundedPercentages[index],
            }));
            if (languagesWithAdjustedPercentage.length > 0) {
                await prisma_1.default.language.createMany({
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
            await prisma_1.default.repository.update({
                where: { id: repositoryId },
                data: {
                    status: "completed",
                    lastAnalyzedAt: new Date(),
                    defaultBranch,
                    size: size,
                },
            });
            await report({ progressPercent: 100, progressMessage: "Completed" });
            console.log(`Repository ${repositoryId} analysis completed`);
        }
        catch (error) {
            console.error(`Error analyzing repository ${repositoryId}:`, error);
            await prisma_1.default.repository.update({
                where: { id: repositoryId },
                data: { status: "failed" },
            });
            await report({ progressMessage: "Failed" });
            throw error;
        }
        finally {
            // Cleanup cloned repository
            if (gitService) {
                await gitService.cleanup();
            }
        }
    }
    /**
     * Get repository with all related data
     */
    async getRepository(id, userId) {
        const repository = await prisma_1.default.repository.findFirst({
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
    async listRepositories(userId) {
        const repositories = await prisma_1.default.repository.findMany({
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
    async deleteRepository(id, userId) {
        const repository = await prisma_1.default.repository.findFirst({
            where: { id, userId },
        });
        if (!repository) {
            throw new Error("Repository not found");
        }
        await prisma_1.default.repository.delete({
            where: { id },
        });
        return { success: true };
    }
    /**
     * Get repository statistics
     */
    async getRepositoryStats(id, userId) {
        const repository = await prisma_1.default.repository.findFirst({
            where: { id, userId },
        });
        if (!repository) {
            throw new Error("Repository not found");
        }
        const [totalCommits, totalContributors, totalFiles, totalBranches, recentActivity,] = await Promise.all([
            prisma_1.default.commit.count({ where: { repositoryId: id } }),
            prisma_1.default.contributor.count({ where: { repositoryId: id } }),
            prisma_1.default.file.count({ where: { repositoryId: id } }),
            prisma_1.default.branch.count({ where: { repositoryId: id } }),
            prisma_1.default.commit.findMany({
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
exports.RepositoryService = RepositoryService;
exports.repositoryService = new RepositoryService();
