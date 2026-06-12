import { GitBranch, Clock, User, CheckCircle, GitCommit, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

interface Branch {
  id: string;
  name: string;
  isDefault: boolean;
  isCurrent: boolean;
  isProtected: boolean;
  lastCommit: {
    hash: string;
    message: string;
    author: string;
    timestamp: string;
  };
  lastCommitAt?: string;
  ahead: number;
  behind: number;
  commits: BranchCommit[];
}

interface BranchCommit {
  hash: string;
  message: string;
  author: string;
  authorName?: string;
  timestamp: string;
  branch: string;
  parents: string[];
  isMerge: boolean;
}

export interface RepositoryBranch {
  id: string | number;
  name: string;
  isDefault?: boolean;
  isProtected?: boolean;
  lastCommitAt?: string | Date;
}

export interface RepositoryCommit {
  id?: string | number;
  hash?: string;
  shortHash?: string;
  message?: string;
  authorName?: string;
  committedAt?: string | Date;
  createdAt?: string | Date;
  branch?: string;
  parents?: string[];
  isMerge?: boolean;
}

interface BranchVisualizationProps {
  repository?: {
    branches?: RepositoryBranch[];
    commits?: RepositoryCommit[];
  };
}

type FilterType = "all" | "active" | "stale" | "merged";

const toSafeIso = (value?: string | Date) => {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

const getBranchAgeInDays = (timestamp: string | Date) => {
  return Math.floor(
    (new Date().getTime() - new Date(timestamp).getTime()) /
      (1000 * 60 * 60 * 24)
  );
};

export function BranchVisualization({ repository }: BranchVisualizationProps) {
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");

  // Use real branches from repository or empty array
  const branches: Branch[] =
    repository?.branches?.map((branch: RepositoryBranch) => ({
      id: branch.id.toString(),
      name: branch.name,
      isDefault: branch.isDefault || false,
      isCurrent: false,
      isProtected: branch.isProtected || false,
      lastCommit: {
        hash: "",
        message: "",
        author: "",
        timestamp: toSafeIso(branch.lastCommitAt),
      },
      ahead: 0,
      behind: 0,
      commits: [],
    })) || [];

  // Debug log
  console.log("[BranchVisualization] Repository:", repository);
  console.log("[BranchVisualization] Branches:", branches);

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    );

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return "Yesterday";
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const filteredBranches = branches.filter((branch) => {
    switch (filter) {
      case "active": {
        return getBranchAgeInDays(branch.lastCommit.timestamp) <= 30;
      }
      case "stale": {
        return getBranchAgeInDays(branch.lastCommit.timestamp) > 30;
      }
      case "merged":
        return branch.ahead === 0 && branch.behind > 0;
      default:
        return true;
    }
  });

  const getBranchTypeColor = (name: string) => {
    if (name.startsWith("feature/"))
      return "bg-blue-500/20 text-blue-500 border-blue-500/30";
    if (name.startsWith("bugfix/") || name.startsWith("hotfix/"))
      return "bg-red-500/20 text-red-500 border-red-500/30";
    if (name === "develop")
      return "bg-purple-500/20 text-purple-500 border-purple-500/30";
    return "bg-green-500/20 text-green-500 border-green-500/30";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="h-6 w-6 text-primary" />
            Branches
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {branches.length} branches in this repository
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="glass px-4 py-2 rounded-lg hover:bg-white/10 transition-all duration-300 cursor-pointer flex items-center gap-2 outline-none">
              {filter === "all" ? "All branches" : filter.charAt(0).toUpperCase() + filter.slice(1)}
              <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass">
              <DropdownMenuItem onClick={() => setFilter("all")} className="cursor-pointer">All branches</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("active")} className="cursor-pointer">Active</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("stale")} className="cursor-pointer">Stale</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("merged")} className="cursor-pointer">Merged</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <GitBranch className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{branches.length}</p>
              <p className="text-xs text-muted-foreground">Total Branches</p>
            </div>
          </div>
        </Card>
        <Card className="glass p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {branches.filter((b) => !b.isDefault && b.behind === 0).length}
              </p>
              <p className="text-xs text-muted-foreground">Up to date</p>
            </div>
          </div>
        </Card>
        <Card className="glass p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <GitCommit className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {branches.reduce((sum, b) => sum + b.ahead, 0)}
              </p>
              <p className="text-xs text-muted-foreground">Commits Ahead</p>
            </div>
          </div>
        </Card>
        <Card className="glass p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {
                  branches.filter(
                    (b) => getBranchAgeInDays(b.lastCommit.timestamp) > 30
                  ).length
                }
              </p>
              <p className="text-xs text-muted-foreground">Stale Branches</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branch list */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Branch List</h3>
          <div className="space-y-3">
            {filteredBranches.length === 0 ? (
              <Card className="glass p-8 text-center">
                <p className="text-muted-foreground">
                  {branches.length === 0
                    ? "No branches found in this repository"
                    : `No ${filter} branches found`}
                </p>
              </Card>
            ) : (
              filteredBranches.map((branch) => (
                <Card
                  key={branch.id}
                  className="glass hover:bg-white/10 transition-all duration-300 cursor-pointer p-4"
                  onClick={() => setSelectedBranch(branch)}
                >
                  <div className="space-y-3">
                    {/* Branch name and badges */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <GitBranch className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="font-medium truncate">
                          {branch.name}
                        </span>
                        {branch.isDefault && (
                          <span className="text-xs glass px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                            default
                          </span>
                        )}
                        {branch.isCurrent && (
                          <span className="text-xs glass px-2 py-0.5 rounded-full bg-green-500/20 text-green-500">
                            current
                          </span>
                        )}
                        {branch.isProtected && (
                          <span className="text-xs glass px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500">
                            protected
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Last commit info */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{branch.lastCommit.author}</span>
                      <span>•</span>
                      <span className="truncate">
                        {branch.lastCommit.message}
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs">
                        {branch.ahead > 0 && (
                          <span className="flex items-center gap-1 text-green-500">
                            <span>↑</span>
                            <span>{branch.ahead} ahead</span>
                          </span>
                        )}
                        {branch.behind > 0 && (
                          <span className="flex items-center gap-1 text-red-500">
                            <span>↓</span>
                            <span>{branch.behind} behind</span>
                          </span>
                        )}
                        {branch.ahead === 0 && branch.behind === 0 && (
                          <span className="flex items-center gap-1 text-green-500">
                            <CheckCircle className="h-3 w-3" />
                            <span>Up to date</span>
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(branch.lastCommit.timestamp)}
                      </span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Branch graph visualization */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Branch Graph</h3>
          <Card className="glass p-6">
            <div className="space-y-4">
              {(repository?.commits || [])
                .slice(0, 10)
                .map((rawCommit: RepositoryCommit, index: number) => {
                  const commit: BranchCommit = {
                    hash: rawCommit.hash || rawCommit.shortHash || "",
                    message: rawCommit.message || "",
                    author: rawCommit.authorName || "Unknown",
                    authorName: rawCommit.authorName || "Unknown",
                    timestamp: toSafeIso(rawCommit.committedAt ?? rawCommit.createdAt),
                    branch: rawCommit.branch || "main",
                    parents: rawCommit.parents || [],
                    isMerge: rawCommit.isMerge || false,
                  };
                  const branchColor = getBranchTypeColor(commit.branch);

                  const commitKey = commit.hash || String(rawCommit.id ?? index);
                  return (
                    <div key={commitKey} className="relative">
                      {/* Connection lines */}
                      {index > 0 && (
                        <div className="absolute left-2 -top-4 h-4 w-px bg-primary/30" />
                      )}

                      <div className="flex items-start gap-3">
                        {/* Commit node */}
                        <div className="relative flex-shrink-0">
                          <div
                            className={`p-1 rounded-full ${branchColor} border-2`}
                          >
                            <div className="h-2 w-2 rounded-full bg-current" />
                          </div>
                        </div>

                        {/* Commit info */}
                        <div className="flex-1 min-w-0 glass p-3 rounded-lg">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {commit.message}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <span>{commit.authorName}</span>
                                <span>•</span>
                                <code className="font-mono">
                                  {commit.hash?.substring(0, 7)}
                                </code>
                              </div>
                            </div>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full border ${branchColor}`}
                            >
                              {commit.branch}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>
        </div>
      </div>

      {/* Selected branch modal */}
      {selectedBranch && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedBranch(null)}
        >
          <Card
            className="glass max-w-2xl w-full p-6 animate-fade-in-up"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <GitBranch className="h-5 w-5" />
                    {selectedBranch.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    {selectedBranch.isDefault && (
                      <span className="text-xs glass px-2 py-1 rounded-full bg-primary/20 text-primary">
                        Default Branch
                      </span>
                    )}
                    {selectedBranch.isCurrent && (
                      <span className="text-xs glass px-2 py-1 rounded-full bg-green-500/20 text-green-500">
                        Current Branch
                      </span>
                    )}
                    {selectedBranch.isProtected && (
                      <span className="text-xs glass px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-500">
                        Protected
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBranch(null)}
                  className="glass p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass p-4 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Ahead</p>
                    <p className="text-2xl font-bold text-green-500">
                      {selectedBranch.ahead}
                    </p>
                    <p className="text-xs text-muted-foreground">commits</p>
                  </div>
                  <div className="glass p-4 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Behind</p>
                    <p className="text-2xl font-bold text-red-500">
                      {selectedBranch.behind}
                    </p>
                    <p className="text-xs text-muted-foreground">commits</p>
                  </div>
                </div>

                <div className="glass p-4 rounded-lg">
                  <p className="text-sm font-medium mb-2">Last Commit</p>
                  <div className="space-y-2">
                    <p className="text-sm">
                      {selectedBranch.lastCommit.message}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{selectedBranch.lastCommit.author}</span>
                      <span>•</span>
                      <code className="font-mono">
                        {selectedBranch.lastCommit.hash}
                      </code>
                      <span>•</span>
                      <span>
                        {formatDate(selectedBranch.lastCommit.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
