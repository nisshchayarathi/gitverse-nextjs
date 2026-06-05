import {
  Users,
  GitCommit,
  Plus,
  Minus,
  TrendingUp,
  Award,
  Calendar,
  X,
  BarChart3,
  Clock,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { Card } from "@/components/ui";
import { useState, useRef, useEffect } from "react";

interface Contributor {
  id: string;
  name: string;
  email: string;
  avatar: string;
  commits: number;
  additions: number;
  deletions: number;
  percentage: number;
  firstCommit: string;
  lastCommit: string;
  weeklyActivity: number[]; // Last 12 weeks
  rank: number;
}

interface ContributorsProps {
  repository?: any;
}

type SortOption = "commits" | "additions" | "recent";

export function Contributors({ repository }: ContributorsProps) {
  const [sortBy, setSortBy] = useState<SortOption>("commits");

  const [selectedContributor, setSelectedContributor] =
    useState<Contributor | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedContributor && modalRef.current) {
      modalRef.current.scrollTop = 0;
  }
  }, [selectedContributor]);
  // Use real contributors from repository or empty array
  const contributors: Contributor[] =
    repository?.contributors?.map((contrib: any, index: number) => ({
      id: contrib.id.toString(),
      name: contrib.name,
      email: contrib.email,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${contrib.name}`,
      commits: contrib.commits,
      additions: contrib.additions,
      deletions: contrib.deletions,
      percentage: contrib.percentage,
      firstCommit: contrib.firstCommit,
      lastCommit: contrib.lastCommit,
      weeklyActivity: [],
      rank: index + 1,
    })) || [];

  const sortedContributors = [...contributors].sort((a, b) => {
    switch (sortBy) {
      case "commits":
        return b.commits - a.commits;
      case "additions":
        return b.additions - a.additions;
      case "recent":
        return (
          new Date(b.lastCommit).getTime() - new Date(a.lastCommit).getTime()
        );
      default:
        return 0;
    }
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { icon: "🥇", color: "text-yellow-500" };
    if (rank === 2) return { icon: "🥈", color: "text-gray-400" };
    if (rank === 3) return { icon: "🥉", color: "text-orange-500" };
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Contributors
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {contributors.length} people have contributed to this repository
          </p>
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="glass px-4 py-2 rounded-lprisma migrate resetg hover:bg-white/10 transition-all duration-300 cursor-pointer"
        >
          <option value="commits">Most commits</option>
          <option value="additions">Most additions</option>
          <option value="recent">Most recent</option>
        </select>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{contributors.length}</p>
              <p className="text-xs text-muted-foreground">
                Total Contributors
              </p>
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
                {contributors.reduce((sum, c) => sum + c.commits, 0)}
              </p>
              <p className="text-xs text-muted-foreground">Total Commits</p>
            </div>
          </div>
        </Card>
        <Card className="glass p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Plus className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {(
                  contributors.reduce((sum, c) => sum + c.additions, 0) / 1000
                ).toFixed(1)}
                K
              </p>
              <p className="text-xs text-muted-foreground">Lines Added</p>
            </div>
          </div>
        </Card>
        <Card className="glass p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Minus className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {(
                  contributors.reduce((sum, c) => sum + c.deletions, 0) / 1000
                ).toFixed(1)}
                K
              </p>
              <p className="text-xs text-muted-foreground">Lines Deleted</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Contributors list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sortedContributors.map((contributor) => {
          const rankBadge = getRankBadge(contributor.rank);
          const maxActivity = Math.max(...contributor.weeklyActivity);

          return (
            <Card
              key={contributor.id}
              className="glass hover:bg-white/10 transition-all duration-300 cursor-pointer p-6"
              onClick={() => setSelectedContributor(contributor)}
            >
              {/* Contributor header */}
              <div className="flex items-start gap-4 mb-4">
                <div className="relative">
                  <Image
                    src={contributor.avatar}
                    alt={contributor.name}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-full ring-2 ring-primary/20 object-cover"
                  />
                  {rankBadge && (
                    <div className="absolute -top-1 -right-1 text-lg">
                      {rankBadge.icon}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">
                      {contributor.name}
                    </h3>
                    {contributor.rank <= 3 && (
                      <Award className={`h-4 w-4 ${rankBadge?.color}`} />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {contributor.email}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">
                    {typeof contributor.percentage === "string"
                      ? parseFloat(contributor.percentage).toFixed(2)
                      : contributor.percentage.toFixed(2)}
                    %
                  </p>
                  <p className="text-xs text-muted-foreground">contribution</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-blue-500 mb-1">
                    <GitCommit className="h-4 w-4" />
                    <span className="font-semibold">{contributor.commits}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Commits</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-green-500 mb-1">
                    <Plus className="h-4 w-4" />
                    <span className="font-semibold">
                      {contributor.additions.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Added</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-red-500 mb-1">
                    <Minus className="h-4 w-4" />
                    <span className="font-semibold">
                      {contributor.deletions.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Deleted</p>
                </div>
              </div>

              {/* Activity graph */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Activity (Last 12 weeks)
                  </span>
                  <span>
                    {contributor.weeklyActivity.reduce((a, b) => a + b, 0)}{" "}
                    commits
                  </span>
                </div>
                <div className="flex items-end gap-1 h-12">
                  {contributor.weeklyActivity.map((count, index) => {
                    const height = (count / maxActivity) * 100;
                    return (
                      <div
                        key={index}
                        className="flex-1 bg-primary/20 rounded-t hover:bg-primary/40 transition-all duration-300 relative group"
                        style={{ height: `${height}%` }}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 glass rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          {count} commits
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Timeline */}
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>First: {formatDate(contributor.firstCommit)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>Last: {formatDate(contributor.lastCommit)}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Selected contributor modal */}
      {selectedContributor && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedContributor(null)}
        >
            <Card
              ref={modalRef}
              className="glass max-w-3xl w-full max-h-[90vh] overflow-y-auto pb-8 animate-fade-in-up"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setSelectedContributor(null)}
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-all z-10"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Header */}
              <div className="mb-8 p-8 pb-0">
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold break-all">
                      {selectedContributor.name}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-2 font-mono break-all">
                      {selectedContributor.email}
                    </p>
                  </div>
                </div>

                {/* Rank and Percentage Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium">
                    #{selectedContributor.rank} Contributor
                  </span>
                  <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm font-medium">
                    {typeof selectedContributor.percentage === "string"
                      ? parseFloat(selectedContributor.percentage).toFixed(2)
                      : selectedContributor.percentage.toFixed(2)}
                    % of commits
                  </span>
                  {selectedContributor.rank <= 3 && (
                    <span className="text-2xl">
                      {selectedContributor.rank === 1
                        ? "🥇"
                        : selectedContributor.rank === 2
                          ? "🥈"
                          : "🥉"}
                    </span>
                  )}
                </div>
              </div>

              {/* Main stats grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 px-8">
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-2 text-blue-400">
                    <GitCommit className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wide">
                      Commits
                    </span>
                  </div>
                  <p className="text-3xl font-bold">
                    {selectedContributor.commits.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Avg{" "}
                    {(
                      selectedContributor.commits / contributors.length
                    ).toFixed(1)}{" "}
                    per contributor
                  </p>
                </div>

                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-2 text-green-400">
                    <Plus className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wide">
                      Added
                    </span>
                  </div>
                  <p className="text-3xl font-bold">
                    {(selectedContributor.additions / 1000).toFixed(1)}K
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {(
                      (selectedContributor.additions /
                        contributors.reduce((sum, c) => sum + c.additions, 0)) *
                      100
                    ).toFixed(1)}
                    % of all additions
                  </p>
                </div>

                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-2 text-red-400">
                    <Minus className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wide">
                      Deleted
                    </span>
                  </div>
                  <p className="text-3xl font-bold">
                    {(selectedContributor.deletions / 1000).toFixed(1)}K
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {(
                      (selectedContributor.deletions /
                        contributors.reduce((sum, c) => sum + c.deletions, 0)) *
                      100
                    ).toFixed(1)}
                    % of all deletions
                  </p>
                </div>

                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-2 text-yellow-400">
                    <BarChart3 className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wide">
                      Impact
                    </span>
                  </div>
                  <p className="text-3xl font-bold">
                    {(
                      selectedContributor.additions +
                      selectedContributor.deletions
                    ).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Total lines changed
                  </p>
                </div>
              </div>

              {/* Activity details */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 px-8">
                {/* Timeline info */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Contribution Timeline
                  </h3>

                  <div className="space-y-4">
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                        First Commit
                      </p>
                      <p className="text-lg font-semibold">
                        {formatDate(selectedContributor.firstCommit)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {Math.floor(
                          (new Date().getTime() -
                            new Date(
                              selectedContributor.firstCommit
                            ).getTime()) /
                            (1000 * 60 * 60 * 24)
                        )}{" "}
                        days ago
                      </p>
                    </div>

                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                        Last Commit
                      </p>
                      <p className="text-lg font-semibold">
                        {formatDate(selectedContributor.lastCommit)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {Math.floor(
                          (new Date().getTime() -
                            new Date(
                              selectedContributor.lastCommit
                            ).getTime()) /
                            (1000 * 60 * 60 * 24)
                        )}{" "}
                        days ago
                      </p>
                    </div>

                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                        Active for
                      </p>
                      <p className="text-lg font-semibold">
                        {Math.floor(
                          (new Date(selectedContributor.lastCommit).getTime() -
                            new Date(
                              selectedContributor.firstCommit
                            ).getTime()) /
                            (1000 * 60 * 60 * 24)
                        )}{" "}
                        days
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        ~
                        {Math.floor(
                          (new Date(selectedContributor.lastCommit).getTime() -
                            new Date(
                              selectedContributor.firstCommit
                            ).getTime()) /
                            (1000 * 60 * 60 * 24 * 7)
                        )}{" "}
                        weeks
                      </p>
                    </div>
                  </div>
                </div>

                {/* Code metrics */}
                <div className="space-y-4 sm:space-y-6">
                  <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary flex-shrink-0" />
                    Code Metrics
                  </h3>

                  <div className="space-y-3 sm:space-y-4">
                    <div className="bg-white/5 rounded-lg p-3 sm:p-4 border border-white/10">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                        Commits per Week
                      </p>
                      <p className="text-base sm:text-lg font-semibold">
                        {(
                          selectedContributor.commits /
                          Math.max(
                            1,
                            Math.floor(
                              (new Date(
                                selectedContributor.lastCommit
                              ).getTime() -
                                new Date(
                                  selectedContributor.firstCommit
                                ).getTime()) /
                                (1000 * 60 * 60 * 24 * 7)
                            )
                          )
                        ).toFixed(1)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Average per week of activity
                      </p>
                    </div>

                    <div className="bg-white/5 rounded-lg p-3 sm:p-4 border border-white/10">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                        Changes per Commit
                      </p>
                      <p className="text-base sm:text-lg font-semibold">
                        {(
                          (selectedContributor.additions +
                            selectedContributor.deletions) /
                          Math.max(1, selectedContributor.commits)
                        ).toFixed(0)}{" "}
                        <span className="text-xs sm:text-sm">lines</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Average changes per commit
                      </p>
                    </div>

                    <div className="bg-white/5 rounded-lg p-3 sm:p-4 border border-white/10">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                        Commit Ratio
                      </p>
                      <p className="text-base sm:text-lg font-semibold break-words">
                        {(
                          (selectedContributor.additions /
                            Math.max(
                              1,
                              selectedContributor.additions +
                                selectedContributor.deletions
                            )) *
                          100
                        ).toFixed(1)}
                        % adds,{" "}
                        {(
                          (selectedContributor.deletions /
                            Math.max(
                              1,
                              selectedContributor.additions +
                                selectedContributor.deletions
                            )) *
                          100
                        ).toFixed(1)}
                        % deletes
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Addition vs deletion ratio
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comparison to others */}
              <div className="bg-gradient-to-r from-primary/10 to-transparent rounded-lg p-4 sm:p-6 border border-white/10 mx-8">
                <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary flex-shrink-0" />
                  Contribution Comparison
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                      vs Average
                    </p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-xl sm:text-2xl font-bold text-primary">
                        {(
                          selectedContributor.commits /
                          (contributors.reduce((sum, c) => sum + c.commits, 0) /
                            contributors.length)
                        ).toFixed(1)}
                        x
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        more commits
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                      Rank
                    </p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-xl sm:text-2xl font-bold text-primary">
                        #{selectedContributor.rank}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        of {contributors.length}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                      Percentile
                    </p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-xl sm:text-2xl font-bold text-primary">
                        {(
                          ((contributors.length - selectedContributor.rank) /
                            contributors.length) *
                          100
                        ).toFixed(0)}
                        %
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        top contributors
                      </p>
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
