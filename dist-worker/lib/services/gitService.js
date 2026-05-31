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
exports.GitService = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const fs_1 = require("fs");
const readline_1 = __importDefault(require("readline"));
const DEFAULT_GIT_TIMEOUT_MS = 2 * 60 * 1000;
const GIT_CLONE_TIMEOUT_MS = 10 * 60 * 1000;
const GIT_LOG_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_COMMITS_DEFAULT = 1000;
const MAX_CONTRIBUTOR_COMMITS = 3000;
const MAX_FILE_BYTES_TO_READ_FOR_LINECOUNT = 256 * 1024; // 256KB
function countLinesReadStream(filePath) {
    return new Promise((resolve, reject) => {
        const stream = (0, fs_1.createReadStream)(filePath, { encoding: "utf-8" });
        let lines = 0;
        let remaining = "";
        stream.on("data", (chunk) => {
            lines += (remaining + chunk).split("\n").length - 1;
            remaining = chunk.endsWith("\n")
                ? ""
                : chunk.slice(chunk.lastIndexOf("\n") + 1);
        });
        stream.on("end", () => {
            resolve(lines + (remaining ? 1 : 0));
        });
        stream.on("error", reject);
    });
}
function spawnOutput(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = (0, child_process_1.spawn)(command, args, {
            ...options,
            env: {
                ...process.env,
                ...options.env,
                // Prevent git from hanging on credential / interactive prompts.
                GIT_TERMINAL_PROMPT: "0",
                GCM_INTERACTIVE: "Never",
                // Avoid fetching large LFS objects during clone/checkout.
                GIT_LFS_SKIP_SMUDGE: "1",
            },
        });
        let stdout = "";
        let stderr = "";
        child.stdout?.on("data", (data) => (stdout += data));
        child.stderr?.on("data", (data) => (stderr += data));
        const timeout = options.timeout ?? DEFAULT_GIT_TIMEOUT_MS;
        const timer = setTimeout(() => {
            child.kill();
            reject(new Error(`Command timed out: ${command} ${args.join(" ")}`));
        }, timeout);
        child.on("close", (code) => {
            clearTimeout(timer);
            if (code === 0) {
                resolve({ stdout, stderr });
            }
            else {
                reject(new Error(`Command failed with code ${code}: ${stderr}`));
            }
        });
        child.on("error", (err) => {
            clearTimeout(timer);
            reject(err);
        });
        if (options.signal) {
            options.signal.addEventListener("abort", () => {
                child.kill();
                reject(new Error("Command aborted"));
            });
        }
    });
}
function parseCommitHeaderLine(line) {
    const parts = line.split("|");
    if (parts.length < 8)
        return null;
    const [hash, shortHash, authorName, authorEmail, date, message, description, parentsStr, refsStr,] = parts;
    if (!hash || !authorName || !authorEmail || !date || !message)
        return null;
    return {
        hash,
        shortHash,
        authorName,
        authorEmail,
        date,
        message,
        description,
        parentsStr: parentsStr ?? "",
        refsStr: refsStr ?? "",
    };
}
function normalizeNumstatFilePath(rawPath) {
    // Numstat uses "a\tb\tpath" and for renames can be "old => new" or "{old => new}".
    const trimmed = rawPath.trim();
    if (!trimmed)
        return trimmed;
    const arrowIndex = trimmed.lastIndexOf(" => ");
    if (arrowIndex === -1)
        return trimmed;
    const after = trimmed.substring(arrowIndex + 4).trim();
    // Handle brace rename form: "src/{old => new}/file.ts" => "src/new/file.ts"
    if (trimmed.includes("{") && trimmed.includes("}")) {
        const braceOpen = trimmed.indexOf("{");
        const braceClose = trimmed.indexOf("}");
        if (braceOpen !== -1 && braceClose !== -1 && braceClose > braceOpen) {
            const prefix = trimmed.substring(0, braceOpen);
            const suffix = trimmed.substring(braceClose + 1);
            return `${prefix}${after}${suffix}`.replace(/\/\/+/, "/");
        }
    }
    return after;
}
class GitService {
    repoPath;
    signal;
    constructor(repoPath, signal) {
        this.repoPath = repoPath;
        this.signal = signal;
    }
    spawnGit(args, options = {}) {
        return spawnOutput("git", args, {
            cwd: this.repoPath,
            signal: this.signal,
            timeout: options.timeout,
        });
    }
    /**
     * Clone a repository to a temporary directory
     */
    static async cloneRepository(url, destination, opts) {
        await fs.mkdir(destination, { recursive: true });
        const depth = Math.max(1, Math.min(opts?.depth ?? 1000, 1000));
        const noSingleBranch = opts?.noSingleBranch ?? true;
        const args = [
            "-c",
            "credential.interactive=never",
            "-c",
            "core.askPass=",
            "-c",
            "filter.lfs.required=false",
            "-c",
            "filter.lfs.smudge=",
            "-c",
            "filter.lfs.process=",
            "clone",
            "--no-tags",
            "--progress",
            "--depth",
            String(depth),
            noSingleBranch ? "--no-single-branch" : "--single-branch",
            url,
            destination,
        ];
        return new Promise((resolve, reject) => {
            const child = (0, child_process_1.spawn)("git", args, {
                stdio: ["ignore", "pipe", "pipe"],
                env: {
                    ...process.env,
                    GIT_TERMINAL_PROMPT: "0",
                    GCM_INTERACTIVE: "Never",
                    GIT_LFS_SKIP_SMUDGE: "1",
                },
                timeout: GIT_CLONE_TIMEOUT_MS,
                signal: opts?.signal,
            });
            let lastReportedPct = 0;
            child.stderr?.on("data", (chunk) => {
                const text = chunk.toString();
                const match = text.match(/Receiving objects:\s+(\d+)%/);
                if (match) {
                    const pct = parseInt(match[1], 10);
                    if (pct - lastReportedPct >= 5 || pct === 100) {
                        lastReportedPct = pct;
                        opts?.onProgress?.(pct, `Cloning repository (${pct}%)`);
                    }
                }
            });
            let stderr = "";
            child.stderr?.on("data", (chunk) => {
                stderr += chunk.toString();
            });
            child.on("close", (code) => {
                if (code === 0) {
                    resolve(new GitService(destination, opts?.signal));
                }
                else {
                    const msg = stderr.trim().split("\n").pop() || `exit code ${code}`;
                    if (msg.toLowerCase().includes("rate limit")) {
                        reject(new Error("GitHub API rate limit exceeded. Please try again later."));
                        return;
                    }
                    reject(new Error(`Failed to clone repository: ${msg}`));
                }
            });
            child.on("error", reject);
        });
    }
    /**
     * Check if a public GitHub repository exists and is accessible.
     */
    static async checkGithubRepositoryExists(url) {
        try {
            const cleanUrl = url.trim().replace(/\/$/, "").replace(/\.git$/, "");
            const parts = cleanUrl.split("/");
            const repo = parts[parts.length - 1];
            const owner = parts[parts.length - 2];
            if (!owner || !repo)
                return false;
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
                headers: {
                    "User-Agent": "GitVerse-App",
                },
            });
            return res.status === 200;
        }
        catch {
            return false;
        }
    }
    /**
     * Get all branches in the repository
     */
    async getBranches() {
        try {
            const { stdout: defaultBranch } = await this.spawnGit(["symbolic-ref", "refs/remotes/origin/HEAD"], { timeout: DEFAULT_GIT_TIMEOUT_MS });
            const defaultBranchName = defaultBranch.trim().replace(/^refs\/remotes\/origin\//, "");
            // Get both local and remote branches
            const { stdout } = await this.spawnGit(["for-each-ref", "--format=%(refname:short)|%(committerdate:iso)|%(objectname)", "refs/heads/", "refs/remotes/origin/"], { timeout: DEFAULT_GIT_TIMEOUT_MS });
            const lines = stdout.trim().split("\n").filter(Boolean);
            const seenBranches = new Set();
            const refEntries = [];
            for (const line of lines) {
                const [fullName, date] = line.split("|");
                // Skip origin/HEAD
                if (fullName.includes("/HEAD"))
                    continue;
                // Remove origin/ prefix from remote branches
                const name = fullName.replace(/^origin\//, "");
                // Skip invalid names and duplicates
                if (!name || name === "origin" || seenBranches.has(name))
                    continue;
                seenBranches.add(name);
                refEntries.push({ name, fullName, date });
            }
            // Fire all rev-list --count in parallel so one bad ref doesn't block the rest.
            const countResults = await Promise.allSettled(refEntries.map((entry) => this.spawnGit(["rev-list", "--count", entry.fullName], { timeout: DEFAULT_GIT_TIMEOUT_MS }).then(({ stdout }) => parseInt(stdout.trim()))));
            const branches = refEntries.map((entry, i) => {
                const result = countResults[i];
                const commitCount = result.status === "fulfilled" ? result.value : 0;
                if (result.status === "rejected") {
                    console.warn(`Failed to get commit count for branch '${entry.name}': ${result.reason}`);
                }
                return {
                    name: entry.name,
                    isDefault: entry.name === defaultBranchName,
                    isProtected: ["main", "master", "develop", "production"].includes(entry.name),
                    commitCount,
                    lastCommitAt: new Date(entry.date),
                };
            });
            return branches;
        }
        catch (error) {
            throw new Error(`Failed to get branches: ${error.message}`);
        }
    }
    /**
     * Get all commits for a specific branch
     */
    async getCommits(branch = "HEAD", limit = MAX_COMMITS_DEFAULT) {
        const effectiveLimit = Math.max(1, Math.min(limit, MAX_COMMITS_DEFAULT));
        const format = "%H|%h|%an|%ae|%aI|%s|%b|%P|%D";
        const args = [
            "-C",
            this.repoPath,
            "log",
            `--format=${format}`,
            "--shortstat",
            "--numstat",
            "-n",
            String(effectiveLimit),
            branch,
        ];
        const spawnOpts = {
            stdio: ["ignore", "pipe", "pipe"],
            env: {
                ...process.env,
                GIT_TERMINAL_PROMPT: "0",
                GCM_INTERACTIVE: "Never",
                GIT_LFS_SKIP_SMUDGE: "1",
            },
            timeout: GIT_LOG_TIMEOUT_MS,
            signal: this.signal,
        };
        return new Promise((resolve, reject) => {
            const child = (0, child_process_1.spawn)("git", args, spawnOpts);
            child.on("error", (err) => {
                reject(new Error(`Failed to get commits: ${err.message}`));
            });
            if (!child.stdout) {
                reject(new Error("Failed to spawn git process: stdout is null"));
                return;
            }
            const rl = readline_1.default.createInterface({ input: child.stdout });
            const commits = [];
            let currentHeader = null;
            let currentFileChanges = [];
            let currentAdditions = 0;
            let currentDeletions = 0;
            let currentFilesChanged = 0;
            const flush = () => {
                if (!currentHeader)
                    return;
                const { hash, shortHash, authorName, authorEmail, date, message, description, parentsStr, refsStr, } = currentHeader;
                const parents = parentsStr
                    ? parentsStr.trim().split(" ").filter(Boolean)
                    : [];
                const tags = [];
                const refs = [];
                let commitBranch = branch === "--all" ? "main" : branch;
                if (refsStr) {
                    const tagMatches = refsStr.matchAll(/tag:\s*([^,)]+)/g);
                    for (const match of tagMatches) {
                        tags.push(match[1].trim());
                    }
                    for (const rawPart of refsStr.split(",")) {
                        const part = rawPart.trim();
                        if (!part)
                            continue;
                        if (/^tag:\s*/.test(part))
                            continue;
                        refs.push(part);
                    }
                    const headMatch = refsStr.match(/HEAD\s*->\s*([^,)]+)/);
                    if (headMatch) {
                        commitBranch = headMatch[1].trim().replace(/^origin\//, "");
                    }
                    else {
                        const branchMatch = refsStr.match(/(?:origin\/)?([a-zA-Z0-9_\-\/]+)(?=,|$|\))/);
                        if (branchMatch && !branchMatch[1].includes("tag:")) {
                            commitBranch = branchMatch[1].trim().replace(/^origin\//, "");
                        }
                    }
                }
                commits.push({
                    hash: hash.trim(),
                    shortHash: shortHash?.trim() || hash.substring(0, 7),
                    message: message.trim(),
                    description: description?.trim() || undefined,
                    authorName: authorName.trim(),
                    authorEmail: authorEmail.trim(),
                    committedAt: new Date(date.trim()),
                    branch: commitBranch,
                    parents,
                    refs,
                    tags,
                    additions: currentAdditions,
                    deletions: currentDeletions,
                    filesChanged: currentFilesChanged,
                    fileChanges: currentFileChanges,
                });
            };
            rl.on("line", (rawLine) => {
                const line = rawLine.trimEnd();
                if (!line)
                    return;
                if (/^[a-f0-9]{40}\|/.test(line)) {
                    flush();
                    currentHeader = parseCommitHeaderLine(line);
                    currentFileChanges = [];
                    currentAdditions = 0;
                    currentDeletions = 0;
                    currentFilesChanged = 0;
                    return;
                }
                if (!currentHeader)
                    return;
                if (line.includes("changed") || line.includes("file")) {
                    const match = line.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
                    if (match) {
                        currentFilesChanged = parseInt(match[1]);
                        currentAdditions = match[2] ? parseInt(match[2]) : 0;
                        currentDeletions = match[3] ? parseInt(match[3]) : 0;
                    }
                    return;
                }
                if (line.includes("\t")) {
                    const parts = line.split("\t");
                    if (parts.length >= 3) {
                        const addStr = parts[0];
                        const delStr = parts[1];
                        const rawPath = parts.slice(2).join("\t");
                        const additions = addStr === "-" ? 0 : parseInt(addStr) || 0;
                        const deletions = delStr === "-" ? 0 : parseInt(delStr) || 0;
                        const filePath = normalizeNumstatFilePath(rawPath);
                        let changeType = "modified";
                        if (additions > 0 && deletions === 0)
                            changeType = "added";
                        else if (additions === 0 && deletions > 0)
                            changeType = "deleted";
                        if (filePath) {
                            currentFileChanges.push({
                                path: filePath,
                                additions,
                                deletions,
                                changeType,
                            });
                        }
                    }
                }
            });
            rl.on("close", () => {
                flush();
                if (commits.length === 0) {
                    console.warn("No commits found in git log output");
                }
                resolve(commits);
            });
            let stderr = "";
            child.stderr?.on("data", (chunk) => {
                stderr += chunk.toString();
            });
            child.on("exit", (code) => {
                if (code !== 0 && commits.length === 0) {
                    reject(new Error(`Failed to get commits: git exited with code ${code}: ${stderr}`));
                }
            });
        });
    }
    /**
     * Get all contributors with their statistics
     */
    async getContributors() {
        try {
            // Contributor scans can be expensive; cap by commit count.
            const { stdout } = await this.spawnGit(["log", "--format=%an|%ae|%aI", "--numstat", "-n", String(MAX_CONTRIBUTOR_COMMITS)], { timeout: GIT_LOG_TIMEOUT_MS });
            const contributorMap = new Map();
            const lines = stdout.trim().split("\n");
            let currentAuthor = null;
            for (const line of lines) {
                if (!line)
                    continue;
                if (line.includes("|") && !line.includes("\t")) {
                    // Author line
                    const [name, email, date] = line.split("|");
                    currentAuthor = { name, email, date: new Date(date) };
                }
                else if (currentAuthor && line.includes("\t")) {
                    // Stats line
                    const [addStr, delStr] = line.split("\t");
                    const additions = addStr === "-" ? 0 : parseInt(addStr) || 0;
                    const deletions = delStr === "-" ? 0 : parseInt(delStr) || 0;
                    const key = currentAuthor.email;
                    const existing = contributorMap.get(key);
                    if (existing) {
                        existing.commits++;
                        existing.additions += additions;
                        existing.deletions += deletions;
                        existing.lastCommit =
                            currentAuthor.date > existing.lastCommit
                                ? currentAuthor.date
                                : existing.lastCommit;
                        existing.firstCommit =
                            currentAuthor.date < existing.firstCommit
                                ? currentAuthor.date
                                : existing.firstCommit;
                    }
                    else {
                        contributorMap.set(key, {
                            name: currentAuthor.name,
                            email: currentAuthor.email,
                            commits: 1,
                            additions,
                            deletions,
                            firstCommit: currentAuthor.date,
                            lastCommit: currentAuthor.date,
                        });
                    }
                }
            }
            return Array.from(contributorMap.values());
        }
        catch (error) {
            throw new Error(`Failed to get contributors: ${error.message}`);
        }
    }
    /**
     * Check if file should be ignored
     */
    shouldIgnoreFile(filePath) {
        const ignoredPatterns = [
            /node_modules\//,
            /\.git\//,
            /dist\//,
            /build\//,
            /out\//,
            /\.next\//,
            /coverage\//,
            /\.cache\//,
            /\.temp\//,
            /\.tmp\//,
            /package-lock\.json$/,
            /yarn\.lock$/,
            /pnpm-lock\.yaml$/,
            /\.lock$/,
            /\.log$/,
            /\.min\.js$/,
            /\.min\.css$/,
            /\.map$/,
            /\.bundle\.js$/,
        ];
        return ignoredPatterns.some((pattern) => pattern.test(filePath));
    }
    /**
     * Get file tree structure
     */
    /**
     * Detect language from file extension
     */
    detectLanguageFromExtension(extension) {
        if (!extension)
            return null;
        const ext = extension.toLowerCase().replace(".", "");
        const languageMap = {
            // JavaScript/TypeScript
            js: "JavaScript",
            jsx: "JavaScript",
            mjs: "JavaScript",
            cjs: "JavaScript",
            ts: "TypeScript",
            tsx: "TypeScript",
            // Python
            py: "Python",
            pyw: "Python",
            pyx: "Python",
            // Java
            java: "Java",
            // C/C++
            c: "C",
            h: "C",
            cpp: "C++",
            cc: "C++",
            cxx: "C++",
            hpp: "C++",
            hxx: "C++",
            // C#
            cs: "C#",
            // Go
            go: "Go",
            // Rust
            rs: "Rust",
            // Ruby
            rb: "Ruby",
            // PHP
            php: "PHP",
            // Swift
            swift: "Swift",
            // Kotlin
            kt: "Kotlin",
            kts: "Kotlin",
            // Scala
            scala: "Scala",
            sc: "Scala",
            // R
            r: "R",
            // Shell
            sh: "Shell",
            bash: "Shell",
            zsh: "Shell",
            // Web
            html: "HTML",
            htm: "HTML",
            css: "CSS",
            scss: "SCSS",
            sass: "Sass",
            less: "Less",
            // Data/Config
            json: "JSON",
            xml: "XML",
            yaml: "YAML",
            yml: "YAML",
            toml: "TOML",
            ini: "INI",
            // Markup
            md: "Markdown",
            markdown: "Markdown",
            rst: "reStructuredText",
            // SQL
            sql: "SQL",
            // Other
            vue: "Vue",
            svelte: "Svelte",
        };
        return languageMap[ext] || null;
    }
    async getFileTree(scope) {
        try {
            const args = ["ls-files"];
            if (scope)
                args.push(scope);
            const { stdout } = await this.spawnGit(args, { timeout: DEFAULT_GIT_TIMEOUT_MS });
            const files = [];
            const filePaths = stdout.trim().split("\n").filter(Boolean);
            // Process in chunks to avoid blocking the event loop on huge monorepos
            const concurrencyLimit = 50;
            for (let i = 0; i < filePaths.length; i += concurrencyLimit) {
                const batch = filePaths.slice(i, i + concurrencyLimit);
                await Promise.all(batch.map(async (filePath) => {
                    // Skip ignored files
                    if (this.shouldIgnoreFile(filePath)) {
                        return;
                    }
                    try {
                        const fullPath = path.join(this.repoPath, filePath);
                        const stats = await fs.stat(fullPath);
                        const name = path.basename(filePath);
                        const extension = path.extname(filePath) || null;
                        // Count lines in the file
                        let lineCount = 0;
                        try {
                            if (stats.size <= MAX_FILE_BYTES_TO_READ_FOR_LINECOUNT) {
                                const content = await fs.readFile(fullPath, "utf-8");
                                lineCount = content.split("\n").length;
                            }
                            else {
                                // Avoid reading very large files into memory.
                                lineCount = Math.ceil(stats.size / 80);
                            }
                        }
                        catch {
                            // If can't read as text, estimate from bytes (avg 80 chars per line)
                            lineCount = Math.ceil(stats.size / 80);
                        }
                        // Detect language from extension
                        const language = this.detectLanguageFromExtension(extension);
                        files.push({
                            path: filePath,
                            name,
                            size: stats.size,
                            extension,
                            lines: lineCount,
                            language,
                        });
                    }
                    catch {
                        // Skip files that can't be accessed
                        return;
                    }
                }));
            }
            return files;
        }
        catch (error) {
            throw new Error(`Failed to get file tree: ${error.message}`);
        }
    }
    /**
     * Detect programming languages in the repository
     */
    async detectLanguages(scope) {
        try {
            const files = await this.getFileTree(scope);
            const languageStats = new Map();
            let totalBytes = 0;
            for (const file of files) {
                if (!file.language)
                    continue;
                const stats = languageStats.get(file.language) || {
                    bytes: 0,
                    lines: 0,
                };
                stats.bytes += file.size;
                stats.lines += file.lines;
                languageStats.set(file.language, stats);
                totalBytes += file.size;
            }
            const languages = [];
            for (const [name, stats] of languageStats.entries()) {
                languages.push({
                    name,
                    bytes: stats.bytes,
                    lines: stats.lines,
                    percentage: (stats.bytes / totalBytes) * 100,
                });
            }
            return languages.sort((a, b) => b.percentage - a.percentage);
        }
        catch (error) {
            throw new Error(`Failed to detect languages: ${error.message}`);
        }
    }
    /**
     * Get repository size in bytes
     */
    async getRepositorySize() {
        try {
            const { stdout } = await spawnOutput("du", ["-sb", "."], {
                cwd: this.repoPath,
                signal: this.signal,
                timeout: DEFAULT_GIT_TIMEOUT_MS,
            });
            return parseInt(stdout.trim().split("\t")[0]);
        }
        catch (error) {
            return 0;
        }
    }
    /**
     * Clean up the cloned repository
     */
    async cleanup() {
        try {
            await fs.rm(this.repoPath, { recursive: true, force: true });
        }
        catch (error) {
            console.error(`Failed to cleanup repository: ${error.message}`);
        }
    }
}
exports.GitService = GitService;
