import {
  spawn,
  type SpawnOptions,
} from "child_process";
import * as path from "path";
import * as fs from "fs/promises";
import { createReadStream } from "fs";
import readline from "readline";
import { normalizeKnownRepoHttpUrl } from "@/lib/utils/repositoryUtils";

const DEFAULT_GIT_TIMEOUT_MS = 2 * 60 * 1000;
const GIT_CLONE_TIMEOUT_MS = 10 * 60 * 1000;
const GIT_LOG_TIMEOUT_MS = 5 * 60 * 1000;
const FORCE_KILL_DELAY_MS = 5_000;
const MAX_COMMITS_DEFAULT = 1000;
const MAX_CONTRIBUTOR_COMMITS = 3000;
const MAX_FILE_BYTES_TO_READ_FOR_LINECOUNT = 256 * 1024; // 256KB

function countLinesReadStream(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath, { encoding: "utf-8" });
    let lines = 0;
    let remaining = "";

    stream.on("data", (chunk: string) => {
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

function killProcess(
  child: import("child_process").ChildProcess,
): void {
  child.kill("SIGTERM");
  setTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {
    }
  }, FORCE_KILL_DELAY_MS);
}

function spawnOutput(
  command: string,
  args: string[],
  options: SpawnOptions & { timeout?: number; signal?: AbortSignal } = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      env: {
        ...process.env,
        ...options.env,
        GIT_TERMINAL_PROMPT: "0",
        GCM_INTERACTIVE: "Never",
        GIT_LFS_SKIP_SMUDGE: "1",
      },
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => (stdout += data));
    child.stderr?.on("data", (data) => (stderr += data));

    const timeout = options.timeout ?? DEFAULT_GIT_TIMEOUT_MS;
    const timer = setTimeout(() => {
      killProcess(child);
      reject(new Error(`Command timed out: ${command} ${args.join(" ")}`));
    }, timeout);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    if (options.signal) {
      options.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        killProcess(child);
        reject(new Error("Command aborted"));
      });
    }
  });
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
  private signal?: AbortSignal;

  constructor(repoPath: string, signal?: AbortSignal) {
    this.repoPath = repoPath;
    this.signal = signal;
  }

  private spawnGit(
    args: string[],
    options: { timeout?: number; signal?: AbortSignal } = {},
  ): Promise<{ stdout: string; stderr: string }> {
    const combined = options.signal || this.signal;
    return spawnOutput("git", args, {
      cwd: this.repoPath,
      signal: combined,
      timeout: options.timeout,
    });
  }

  /**
   * Clone a repository to a temporary directory
   */
  static async cloneRepository(
    url: string,
    destination: string,
    opts?: {
      depth?: number;
      noSingleBranch?: boolean;
      onProgress?: (percent: number, message: string) => void;
      signal?: AbortSignal;
      accessToken?: string;
    },
  ): Promise<GitService> {
    const normalizedUrl = normalizeKnownRepoHttpUrl(url);
    let finalUrl = normalizedUrl || url;
    
    // Inject access token for GitHub private repositories
    if (opts?.accessToken && finalUrl.includes("github.com")) {
      const parsedUrl = new URL(finalUrl);
      parsedUrl.username = "x-access-token";
      parsedUrl.password = opts.accessToken;
      finalUrl = parsedUrl.toString();
    }

    if (!normalizedUrl) {
      const sshMatch = url.match(/^git@([^:]+):([^\/]+)\/(.+?)(?:\.git)?$/);
      if (!sshMatch) {
        throw new Error("Invalid repository URL format");
      }
      const host = sshMatch[1];
      const owner = sshMatch[2];
      const repo = sshMatch[3];
      const allowedHosts = new Set(["github.com", "gitlab.com", "bitbucket.org"]);
      if (!allowedHosts.has(host)) {
        throw new Error(`Repository host ${host} is not allowed`);
      }
      finalUrl = `https://${host}/${owner}/${repo}`;
    }

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
      finalUrl,
      destination,
    ];

    return new Promise((resolve, reject) => {
      const child = spawn("git", args, {
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

      child.stderr?.on("data", (chunk: Buffer) => {
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
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      if (opts?.signal) {
        opts.signal.addEventListener("abort", () => {
          killProcess(child);
          reject(new Error("Repository clone aborted"));
        });
      }

      child.on("close", (code) => {
        if (code === 0) {
          resolve(new GitService(destination, opts?.signal));
        } else {
          const msg = stderr.trim().split("\n").pop() || `exit code ${code}`;

          if (msg.toLowerCase().includes("rate limit")) {
            reject(
              new Error(
                "GitHub API rate limit exceeded. Please try again later.",
              ),
            );
            return;
          }
          const sanitizedMsg = msg.replace(/x-access-token:[^@]+@/g, "***@");
          reject(new Error(`Failed to clone repository: ${sanitizedMsg}`));
        }
      });

      child.on("error", reject);
    });
  }

  /**
   * Check if a public GitHub repository exists and is accessible.
   */
  static async checkGithubRepositoryExists(url: string, accessToken?: string): Promise<boolean> {
    const match = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    if (!match) return false;

    const [, owner, repo] = match;
    const headers: Record<string, string> = { "User-Agent": "GitVerse" };
    
    if (accessToken) {
      headers["Authorization"] = `token ${accessToken}`;
    }

    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Get the remote repository size in bytes (via GitHub API if applicable).
   */
  static async getRemoteRepositorySize(url: string, accessToken?: string): Promise<number | null> {
    try {
      const cleanUrl = url.trim().replace(/\/$/, "").replace(/\.git$/, "");
      const parts = cleanUrl.split("/");
      const repo = parts[parts.length - 1];
      const owner = parts[parts.length - 2];

      if (!owner || !repo) return null;
      if (!cleanUrl.includes("github.com")) return null;

      const headers: Record<string, string> = { "User-Agent": "GitVerse-App" };
      if (accessToken) {
        headers["Authorization"] = `token ${accessToken}`;
      }

      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      if (res.status === 200) {
        const data = await res.json();
        // GitHub API returns size in KB
        return data.size * 1024;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get all branches in the repository
   */
  async getBranches(signal?: AbortSignal): Promise<BranchData[]> {
    try {
      const { stdout: defaultBranch } = await this.spawnGit(
        ["symbolic-ref", "refs/remotes/origin/HEAD"],
        { timeout: DEFAULT_GIT_TIMEOUT_MS, signal },
      );
      const defaultBranchName = defaultBranch.trim().replace(/^refs\/remotes\/origin\//, "");

      // Get both local and remote branches
      const { stdout } = await this.spawnGit(
        ["for-each-ref", "--format=%(refname:short)|%(committerdate:iso)|%(objectname)", "refs/heads/", "refs/remotes/origin/"],
        { timeout: DEFAULT_GIT_TIMEOUT_MS, signal },
      );

      const lines = stdout.trim().split("\n").filter(Boolean);
      const seenBranches = new Set<string>();
      const refEntries: { name: string; fullName: string; date: string }[] = [];

      for (const line of lines) {
        const [fullName, date] = line.split("|");

        // Skip origin/HEAD
        if (fullName.includes("/HEAD")) continue;

        // Remove origin/ prefix from remote branches
        const name = fullName.replace(/^origin\//, "");

        // Skip invalid names and duplicates
        if (!name || name === "origin" || seenBranches.has(name)) continue;
        seenBranches.add(name);

        refEntries.push({ name, fullName, date });
      }

      // 🔥 FIX: Process in chunks to prevent process bombs on repositories with many branches
      const countResults: PromiseSettledResult<number>[] = [];
      const concurrencyLimit = 50;
      for (let i = 0; i < refEntries.length; i += concurrencyLimit) {
        const batch = refEntries.slice(i, i + concurrencyLimit);
        const batchResults = await Promise.allSettled(
          (batch ?? []).map((entry) =>
            this.spawnGit(
              ["rev-list", "--count", entry.fullName],
              { timeout: DEFAULT_GIT_TIMEOUT_MS, signal },
            ).then(({ stdout }) => parseInt(stdout.trim())),
            .catch(err => console.error(err))