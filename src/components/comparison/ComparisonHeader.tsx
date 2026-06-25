import React, { useState, useEffect } from "react";
import { Star, GitFork, AlertCircle, Shield, HardDrive, Clock, ExternalLink } from "lucide-react";

interface RepoItem {
  id: number;
  name: string;
  url: string;
  description?: string;
  stars?: number;
  forks?: number;
  size?: number;
  defaultBranch?: string;
  lastAnalyzedAt?: string | Date;
  _count?: {
    commits: number;
    contributors: number;
    files: number;
    branches: number;
  };
}

interface DetailedRepo extends RepoItem {
  branches: Array<{ name: string; isDefault: boolean }>;
  commits: Array<{ message: string; authorName: string; committedAt: string }>;
  contributors: Array<{ name: string; commits: number }>;
}

interface ComparisonHeaderProps {
  repo: DetailedRepo;
}

export function ComparisonHeader({ repo }: ComparisonHeaderProps) {
  const [liveData, setLiveData] = useState<{
    stars: number;
    forks: number;
    openIssues: number | null;
    license: string | null;
    size: number | null;
    lastCommitDate: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // Helper to parse github url
  const parseGithubUrl = (url: string) => {
    try {
      const cleanUrl = url.trim().replace(/\/$/, "");
      const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace(/\.git$/, ""),
        };
      }
    } catch (e) {
      console.error("Failed to parse URL:", e);
    }
    return null;
  };

  useEffect(() => {
    const fetchGitHubStats = async () => {
      const parsed = parseGithubUrl(repo.url);
      if (!parsed) return;

      setLoading(true);
      try {
        const res = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`);
        if (res.ok) {
          const data = await res.json();
          setLiveData({
            stars: data.stargazers_count,
            forks: data.forks_count,
            openIssues: data.open_issues_count ?? null,
            license: data.license?.spdx_id || data.license?.name || null,
            size: typeof data.size === "number" ? data.size * 1024 : null, // GitHub API size is in KB, convert to bytes
            lastCommitDate: data.pushed_at,
          });
        }
      } catch (err) {
        console.warn("Failed to fetch live GitHub stats, falling back to local DB values:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchGitHubStats();
  }, [repo.url]);

  // Formatter for repository size
  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Formatter for date
  const formatDate = (dateStr?: string | Date) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Local fallback values
  const starsCount = liveData?.stars ?? repo.stars ?? 0;
  const forksCount = liveData?.forks ?? repo.forks ?? 0;
  const openIssuesCount = liveData ? liveData.openIssues : null;
  const licenseType = liveData ? (liveData.license ?? "N/A") : "N/A";
  const repoSize = liveData ? (liveData.size ?? repo.size ?? null) : (repo.size ?? null);
  
  // Last commit date fallback
  const lastCommitDate = liveData?.lastCommitDate ?? 
    (repo.commits && repo.commits.length > 0 ? repo.commits[0].committedAt : repo.lastAnalyzedAt);

  return (
    <div className="glass border border-border/50 rounded-2xl p-6 relative overflow-hidden group hover:border-border hover:shadow-xl transition-all duration-300">
      {/* Background glow animation */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-primary/5 blur-3xl rounded-full group-hover:bg-primary/10 transition-colors duration-500" />
      
      <div className="relative z-10 space-y-5">
        {/* Name and GitHub Link */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-2xl font-bold text-foreground truncate group-hover:text-primary transition-colors duration-300">
              {repo.name}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {repo.url}
            </p>
          </div>
          <a
            href={repo.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-border/50 hover:bg-white/10 hover:text-primary text-xs font-semibold text-muted-foreground transition-all duration-300"
          >
            GitHub
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
          {repo.description || "No description provided."}
        </p>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
          {/* Stars */}
          <div className="glass border border-border/30 rounded-xl p-3 flex items-center gap-3">
            <Star className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Stars</span>
              <span className="text-base font-bold text-foreground">
                {starsCount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Forks */}
          <div className="glass border border-border/30 rounded-xl p-3 flex items-center gap-3">
            <GitFork className="h-5 w-5 text-blue-400 shrink-0" />
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Forks</span>
              <span className="text-base font-bold text-foreground">
                {forksCount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Open Issues */}
          <div className="glass border border-border/30 rounded-xl p-3 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Open Issues</span>
              <span className="text-base font-bold text-foreground">
                {loading ? "..." : openIssuesCount === null ? "N/A" : openIssuesCount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Size */}
          <div className="glass border border-border/30 rounded-xl p-3 flex items-center gap-3">
            <HardDrive className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Size</span>
              <span className="text-base font-bold text-foreground">
                {repoSize === null ? "N/A" : formatSize(repoSize)}
              </span>
            </div>
          </div>

          {/* License */}
          <div className="glass border border-border/30 rounded-xl p-3 flex items-center gap-3">
            <Shield className="h-5 w-5 text-purple-400 shrink-0" />
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">License</span>
              <span className="text-base font-bold text-foreground truncate max-w-[80px]">
                {licenseType}
              </span>
            </div>
          </div>

          {/* Last Activity */}
          <div className="glass border border-border/30 rounded-xl p-3 flex items-center gap-3 col-span-2 sm:col-span-1">
            <Clock className="h-5 w-5 text-indigo-400 shrink-0" />
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Last Commit</span>
              <span className="text-base font-bold text-foreground">
                {formatDate(lastCommitDate)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
