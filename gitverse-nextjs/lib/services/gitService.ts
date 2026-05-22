import { exec, type ExecOptions } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs/promises";

const execPromiseRaw = promisify(exec);

const DEFAULT_EXEC_OPTIONS: ExecOptions = {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024, // git/log outputs can be large
};

const DEFAULT_GIT_TIMEOUT_MS = 2 * 60 * 1000;
const GIT_CLONE_TIMEOUT_MS = 10 * 60 * 1000;
const GIT_LOG_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_COMMITS_DEFAULT = 1000;
const MAX_CONTRIBUTOR_COMMITS = 3000;
const MAX_FILE_BYTES_TO_READ_FOR_LINECOUNT = 256 * 1024; // 256KB

function execPromise(
  command: string,
  options: ExecOptions = {},
): Promise<{ stdout: string; stderr: string }> {
  return execPromiseRaw(command, {
    ...DEFAULT_EXEC_OPTIONS,
    ...options,
    timeout: options.timeout ?? DEFAULT_GIT_TIMEOUT_MS,
    env: {
      ...process.env,
      ...options.env,
      // Prevent git from hanging on credential / interactive prompts.
      GIT_TERMINAL_PROMPT: "0",
      GCM_INTERACTIVE: "Never",
      // Avoid fetching large LFS objects during clone/checkout.
      GIT_LFS_SKIP_SMUDGE: "1",
    },
  }) as unknown as Promise<{ stdout: string; stderr: string }>;
}

type ParsedCommitHeader = {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  message: string;
  description: string;
  parentsStr: string;
  refsStr: string;
};

function parseCommitHeaderLine(line: string): ParsedCommitHeader | null {
  const parts = line.split("|");
  if (parts.length < 8) return null;
  const [
    hash,
    shortHash,
    authorName,
    authorEmail,
    date,
    message,
    description,
    parentsStr,
    refsStr,
  ] = parts;
  if (!hash || !authorName || !authorEmail || !date || !message) return null;

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

function normalizeNumstatFilePath(rawPath: string): string {
  // Numstat uses "a\tb\tpath" and for renames can be "old => new" or "{old => new}".
  const trimmed = rawPath.trim();
  if (!trimmed) return trimmed;
  const arrowIndex = trimmed.lastIndexOf(" => ");
  if (arrowIndex === -1) return trimmed;
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

export interface CommitData {
  hash: string;
  shortHash: string;
  message: string;
  description?: string;
  authorName: string;
  authorEmail: string;
  committedAt: Date;
  branch: string;
  parents: string[]; // Parent commit hashes
  refs: string[]; // Decorations from %D (branches/remotes/HEAD -> ...), excluding tags
  tags: string[]; // Git tags
  additions: number;
  deletions: number;
  filesChanged: number;
  fileChanges: FileChangeData[];
}

export interface FileChangeData {
  path: string;
  additions: number;
  deletions: number;
  changeType: "added" | "modified" | "deleted";
}

export interface BranchData {
  name: string;
  isDefault: boolean;
  isProtected: boolean;
  commitCount: number;
  lastCommitAt: Date;
}

export interface ContributorData {
  name: string;
  email: string;
  commits: number;
  additions: number;
  deletions: number;
  firstCommit: Date;
  lastCommit: Date;
}

export interface LanguageData {
  name: string;
  percentage: number;
  bytes: number;
  lines: number;
}

export class GitService {
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  /**
   * Clone a repository to a temporary directory
   */
  static async cloneRepository(
    url: string,
    destination: string,
    opts?: { depth?: number; noSingleBranch?: boolean },
  ): Promise<GitService> {
    try {
      await fs.mkdir(destination, { recursive: true });
      const depth = Math.max(1, Math.min(opts?.depth ?? 1000, 1000));
      const noSingleBranch = opts?.noSingleBranch ?? true;
      // Clone with all branches by default (--no-single-branch fetches all branches)
      await execPromise(
        `git -c credential.interactive=never -c core.askPass= -c filter.lfs.required=false -c filter.lfs.smudge= -c filter.lfs.process= clone --no-tags --depth ${depth} ${noSingleBranch ? "--no-single-branch" : "--single-branch"} "${url}" "${destination}"`,
        {
          // Cloning can take a while on larger repos.
          timeout: GIT_CLONE_TIMEOUT_MS,
        },
      );
      const gitService = new GitService(destination);
      return gitService;
    } catch (error: any) {
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }

  /**
   * Get all branches in the repository
   */
  async getBranches(): Promise<BranchData[]> {
    try {
      const { stdout: defaultBranch } = await execPromise(
        `cd "${this.repoPath}" && git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'`,
        { timeout: DEFAULT_GIT_TIMEOUT_MS },
      );
      const defaultBranchName = defaultBranch.trim();

      // Get both local and remote branches
      const { stdout } = await execPromise(
        `cd "${this.repoPath}" && git for-each-ref --format='%(refname:short)|%(committerdate:iso)|%(objectname)' refs/heads/ refs/remotes/origin/`,
        { timeout: DEFAULT_GIT_TIMEOUT_MS },
      );

      const branches: BranchData[] = [];
      const lines = stdout.trim().split("\n").filter(Boolean);
      const seenBranches = new Set<string>();

      for (const line of lines) {
        const [fullName, date] = line.split("|");

        // Skip origin/HEAD
        if (fullName.includes("/HEAD")) continue;

        // Remove origin/ prefix from remote branches
        const name = fullName.replace(/^origin\//, "");

        // Skip invalid names and duplicates
        if (!name || name === "origin" || seenBranches.has(name)) continue;
        seenBranches.add(name);

        const { stdout: commitCount } = await execPromise(
          `cd "${this.repoPath}" && git rev-list --count "${fullName}"`,
          { timeout: DEFAULT_GIT_TIMEOUT_MS },
        );

        branches.push({
          name,
          isDefault: name === defaultBranchName,
          isProtected: ["main", "master", "develop", "production"].includes(
            name,
          ),
          commitCount: parseInt(commitCount.trim()),
          lastCommitAt: new Date(date),
        });
      }

      return branches;
    } catch (error: any) {
      throw new Error(`Failed to get branches: ${error.message}`);
    }
  }

  /**
   * Get all commits for a specific branch
   */
  async getCommits(
    branch: string = "HEAD",
    limit: number = MAX_COMMITS_DEFAULT,
  ): Promise<CommitData[]> {
    try {
      const effectiveLimit = Math.max(1, Math.min(limit, MAX_COMMITS_DEFAULT));
      // %P = parent hashes, %D = ref names (tags, branches)
      const format = "%H|%h|%an|%ae|%aI|%s|%b|%P|%D";
      // Use one git log invocation to gather commits + shortstat + numstat; avoids N x `git show`.
      const cmd = `cd "${this.repoPath}" && git log --format="${format}" --shortstat --numstat -n ${effectiveLimit} "${branch}"`;
      const { stdout } = await execPromise(cmd, {
        timeout: GIT_LOG_TIMEOUT_MS,
      });

      const commits: CommitData[] = [];

      // Stream-parse the output.
      let currentHeader: ParsedCommitHeader | null = null;
      let currentFileChanges: FileChangeData[] = [];
      let currentAdditions = 0;
      let currentDeletions = 0;
      let currentFilesChanged = 0;

      const flush = () => {
        if (!currentHeader) return;

        const {
          hash,
          shortHash,
          authorName,
          authorEmail,
          date,
          message,
          description,
          parentsStr,
          refsStr,
        } = currentHeader;

        const parents = parentsStr
          ? parentsStr.trim().split(" ").filter(Boolean)
          : [];

        const tags: string[] = [];
        const refs: string[] = [];

        let commitBranch = branch === "--all" ? "main" : branch;

        if (refsStr) {
          const tagMatches = refsStr.matchAll(/tag:\s*([^,)]+)/g);
          for (const match of tagMatches) {
            tags.push(match[1].trim());
          }

          for (const rawPart of refsStr.split(",")) {
            const part = rawPart.trim();
            if (!part) continue;
            if (/^tag:\s*/.test(part)) continue;
            refs.push(part);
          }

          const headMatch = refsStr.match(/HEAD\s*->\s*([^,)]+)/);
          if (headMatch) {
            commitBranch = headMatch[1].trim().replace(/^origin\//, "");
          } else {
            const branchMatch = refsStr.match(
              /(?:origin\/)?([a-zA-Z0-9_\-\/]+)(?=,|$|\))/,
            );
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

      const lines = stdout.split("\n");
      for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (!line) continue;

        // Commit header begins with 40-hex hash then pipe.
        if (/^[a-f0-9]{40}\|/.test(line)) {
          flush();
          currentHeader = parseCommitHeaderLine(line);
          currentFileChanges = [];
          currentAdditions = 0;
          currentDeletions = 0;
          currentFilesChanged = 0;
          continue;
        }

        if (!currentHeader) {
          continue;
        }

        // Shortstat line: "N files changed, X insertions(+), Y deletions(-)"
        if (line.includes("changed") || line.includes("file")) {
          const match = line.match(
            /(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/,
          );
          if (match) {
            currentFilesChanged = parseInt(match[1]);
            currentAdditions = match[2] ? parseInt(match[2]) : 0;
            currentDeletions = match[3] ? parseInt(match[3]) : 0;
          }
          continue;
        }

        // Numstat line: "add\tdel\tpath" (add/del can be '-')
        if (line.includes("\t")) {
          const parts = line.split("\t");
          if (parts.length >= 3) {
            const addStr = parts[0];
            const delStr = parts[1];
            const rawPath = parts.slice(2).join("\t");
            const additions = addStr === "-" ? 0 : parseInt(addStr) || 0;
            const deletions = delStr === "-" ? 0 : parseInt(delStr) || 0;
            const filePath = normalizeNumstatFilePath(rawPath);

            let changeType: "added" | "modified" | "deleted" = "modified";
            if (additions > 0 && deletions === 0) changeType = "added";
            else if (additions === 0 && deletions > 0) changeType = "deleted";

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
      }

      flush();

      if (commits.length === 0) {
        console.warn("No commits found in git log output");
      }
      return commits;
    } catch (error: any) {
      throw new Error(`Failed to get commits: ${error.message}`);
    }
  }

  /**
   * Get all contributors with their statistics
   */
  async getContributors(): Promise<ContributorData[]> {
    try {
      // Contributor scans can be expensive; cap by commit count.
      const { stdout } = await execPromise(
        `cd "${this.repoPath}" && git log --format="%an|%ae|%aI" --numstat -n ${MAX_CONTRIBUTOR_COMMITS}`,
        { timeout: GIT_LOG_TIMEOUT_MS },
      );

      const contributorMap = new Map<string, ContributorData>();
      const lines = stdout.trim().split("\n");
      let currentAuthor: { name: string; email: string; date: Date } | null =
        null;

      for (const line of lines) {
        if (!line) continue;

        if (line.includes("|") && !line.includes("\t")) {
          // Author line
          const [name, email, date] = line.split("|");
          currentAuthor = { name, email, date: new Date(date) };
        } else if (currentAuthor && line.includes("\t")) {
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
          } else {
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
    } catch (error: any) {
      throw new Error(`Failed to get contributors: ${error.message}`);
    }
  }

  /**
   * Check if file should be ignored
   */
  private shouldIgnoreFile(filePath: string): boolean {
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
  private detectLanguageFromExtension(extension: string | null): string | null {
    if (!extension) return null;

    const ext = extension.toLowerCase().replace(".", "");
    const languageMap: Record<string, string> = {
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

  async getFileTree(): Promise<
    {
      path: string;
      name: string;
      size: number;
      extension: string | null;
      lines: number;
      language: string | null;
    }[]
  > {
    try {
      const { stdout } = await execPromise(
        `cd "${this.repoPath}" && git ls-files`,
        { timeout: DEFAULT_GIT_TIMEOUT_MS },
      );

      const files: {
        path: string;
        name: string;
        size: number;
        extension: string | null;
        lines: number;
        language: string | null;
      }[] = [];
      const filePaths = stdout.trim().split("\n").filter(Boolean);

      for (const filePath of filePaths) {
        // Skip ignored files
        if (this.shouldIgnoreFile(filePath)) {
          continue;
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
            } else {
              // Avoid reading very large files into memory.
              lineCount = Math.ceil(stats.size / 80);
            }
          } catch {
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
        } catch {
          // Skip files that can't be accessed
          continue;
        }
      }

      return files;
    } catch (error: any) {
      throw new Error(`Failed to get file tree: ${error.message}`);
    }
  }

  /**
   * Detect programming languages in the repository
   */
  async detectLanguages(): Promise<LanguageData[]> {
    try {
      const files = await this.getFileTree();

      const languageStats = new Map<string, { bytes: number; lines: number }>();
      let totalBytes = 0;

      const extensionToLanguage: Record<string, string> = {
        ".ts": "TypeScript",
        ".tsx": "TypeScript",
        ".js": "JavaScript",
        ".jsx": "JavaScript",
        ".py": "Python",
        ".java": "Java",
        ".go": "Go",
        ".rs": "Rust",
        ".cpp": "C++",
        ".c": "C",
        ".cs": "C#",
        ".rb": "Ruby",
        ".php": "PHP",
        ".swift": "Swift",
        ".kt": "Kotlin",
        ".css": "CSS",
        ".scss": "SCSS",
        ".html": "HTML",
        ".json": "JSON",
        ".md": "Markdown",
        ".yml": "YAML",
        ".yaml": "YAML",
      };

      for (const file of files) {
        if (file.extension) {
          const language = extensionToLanguage[file.extension];
          if (language) {
            const stats = languageStats.get(language) || { bytes: 0, lines: 0 };
            stats.bytes += file.size;

            // Count lines in the file
            try {
              const fullPath = path.join(this.repoPath, file.path);
              if (file.size <= MAX_FILE_BYTES_TO_READ_FOR_LINECOUNT) {
                const content = await fs.readFile(fullPath, "utf-8");
                const lineCount = content.split("\n").length;
                stats.lines += lineCount;
              } else {
                stats.lines += Math.ceil(file.size / 80);
              }
            } catch {
              // If can't read file, estimate lines from bytes (avg 80 chars per line)
              stats.lines += Math.ceil(file.size / 80);
            }

            languageStats.set(language, stats);
            totalBytes += file.size;
          }
        }
      }

      const languages: LanguageData[] = [];
      for (const [name, stats] of languageStats.entries()) {
        languages.push({
          name,
          bytes: stats.bytes,
          lines: stats.lines,
          percentage: (stats.bytes / totalBytes) * 100,
        });
      }

      return languages.sort((a, b) => b.percentage - a.percentage);
    } catch (error: any) {
      throw new Error(`Failed to detect languages: ${error.message}`);
    }
  }

  /**
   * Get repository size in bytes
   */
  async getRepositorySize(): Promise<number> {
    try {
      const { stdout } = await execPromise(
        `cd "${this.repoPath}" && du -sb . | cut -f1`,
        { timeout: DEFAULT_GIT_TIMEOUT_MS },
      );
      return parseInt(stdout.trim());
    } catch (error: any) {
      return 0;
    }
  }

  /**
   * Clean up the cloned repository
   */
  async cleanup(): Promise<void> {
    try {
      await fs.rm(this.repoPath, { recursive: true, force: true });
    } catch (error: any) {
      console.error(`Failed to cleanup repository: ${error.message}`);
    }
  }
}
