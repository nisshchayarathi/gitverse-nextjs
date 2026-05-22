import { FileText, Plus, Minus, GitMerge, Tag, GitCommit } from "lucide-react";
import { useState, useMemo } from "react";
import { EmptyState } from "@/components/ui";

interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  type: "added" | "modified" | "deleted";
}

interface Commit {
  hash: string;
  shortHash: string;
  author: {
    name: string;
    email: string;
    avatar: string;
  };
  message: string;
  description?: string;
  timestamp: string;
  branch: string;
  refs?: string[];
  filesChanged: number;
  additions: number;
  deletions: number;
  fileChanges: FileChange[];
  parents?: string[];
  isMerge?: boolean;
  tags?: string[];
}

interface GraphNode {
  commit: Commit;
  column: number;
  color: string;
  routes: Array<{
    fromColumn: number;
    toColumn: number;
    color: string;
    isMerge?: boolean;
    startY?: number;
    endY?: number | string;
  }>;
}

interface CommitHistoryProps {
  repository?: any;
}

export const CommitHistory = ({ repository }: CommitHistoryProps) => {
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null);

  const DOT_Y = 8;
  const CURVE_END_Y = 50;

  // Branch colors for visualization
  const branchColors = [
    "#3b82f6", // blue
    "#ef4444", // red
    "#10b981", // green
    "#f59e0b", // amber
    "#8b5cf6", // purple
    "#ec4899", // pink
    "#06b6d4", // cyan
  ];

  const defaultBranch =
    repository?.branches?.find((b: any) => b.isDefault)?.name || "main";

  const normalizeBranchName = (value: unknown): string => {
    const str = typeof value === "string" ? value.trim() : "";
    if (!str) return defaultBranch;
    if (str === "--all") return defaultBranch;
    if (/^\d+$/.test(str)) return defaultBranch;
    return str;
  };

  // Use real commits from repository or empty array
  const commits: Commit[] =
    repository?.commits?.map((commit: any) => ({
      hash: commit.hash,
      shortHash: commit.shortHash,
      author: {
        name: commit.authorName,
        email: commit.authorEmail,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${commit.authorName}`,
      },
      message: commit.message,
      description: commit.description,
      timestamp: commit.committedAt,
      branch: normalizeBranchName(commit.branch),
      refs: Array.isArray(commit.refs) ? commit.refs : [],
      filesChanged: commit.filesChanged || 0,
      additions: commit.additions || 0,
      deletions: commit.deletions || 0,
      fileChanges:
        commit.fileChanges?.map((fc: any) => ({
          path: fc.path,
          additions: fc.additions,
          deletions: fc.deletions,
          type: fc.changeType,
        })) || [],
      parents: commit.parents || [],
      isMerge: commit.parents?.length > 1,
      tags: commit.tags || [],
    })) || [];

  const refToBadgeText = (ref: string) => {
    const trimmed = ref.trim();
    const head = trimmed.match(/HEAD\s*->\s*(.+)$/);
    if (head) return head[1].trim();
    return trimmed;
  };

  const getDisplayRefs = (commit: Commit): string[] => {
    const refs = Array.isArray(commit.refs) ? commit.refs : [];
    const cleaned = refs
      .map((r) => r.trim())
      .filter(Boolean)
      .filter((r) => !/^tag:\s*/.test(r))
      .filter((r) => !/^\d+$/.test(r));

    if (cleaned.length > 0) return cleaned;
    return [commit.branch].filter(Boolean);
  };

  // Calculate graph layout using a lane-tracking DAG algorithm (Git Graph style)
  const graphNodes: GraphNode[] = useMemo(() => {
    if (commits.length === 0) return [];

    const nodes: GraphNode[] = [];
    let colorIndex = 0;

    // lanes[i] holds the commit hash expected to appear on lane i in the next rows.
    let lanes: Array<string | null> = [];
    const laneColors: string[] = [];

    for (const commit of commits) {
      const routes: GraphNode["routes"] = [];
      const lanesBefore = lanes.slice();

      // Pick/assign a lane for this commit.
      let laneIndex = lanesBefore.indexOf(commit.hash);
      if (laneIndex === -1) {
        laneIndex = lanesBefore.indexOf(null);
        if (laneIndex === -1) laneIndex = lanesBefore.length;
      }

      while (lanes.length <= laneIndex) lanes.push(null);
      while (laneColors.length <= laneIndex) laneColors.push("");

      if (!laneColors[laneIndex]) {
        laneColors[laneIndex] = branchColors[colorIndex % branchColors.length];
        colorIndex++;
      }
      const color = laneColors[laneIndex];

      const laneHadIncoming = lanesBefore[laneIndex] === commit.hash;

      const parents = Array.isArray(commit.parents) ? commit.parents : [];
      const primaryParent = parents[0] ?? null;
      const secondaryParents = parents.slice(1);

      const lanesAfter = lanesBefore.slice();
      while (lanesAfter.length <= laneIndex) lanesAfter.push(null);
      lanesAfter[laneIndex] = primaryParent;

      const parentLaneIndexes: number[] = [];
      for (const parentHash of secondaryParents) {
        let parentLane = lanesAfter.indexOf(parentHash);
        if (parentLane === -1) {
          parentLane = lanesAfter.indexOf(null);
          if (parentLane === -1) parentLane = lanesAfter.length;
          if (parentLane >= lanesAfter.length) lanesAfter.push(parentHash);
          else lanesAfter[parentLane] = parentHash;
        }

        while (laneColors.length <= parentLane) laneColors.push("");
        if (!laneColors[parentLane]) {
          laneColors[parentLane] =
            branchColors[colorIndex % branchColors.length];
          colorIndex++;
        }

        parentLaneIndexes.push(parentLane);
      }

      // If this lane's primary parent is already continuing on another lane,
      // collapse this lane here so we don't draw an extra line below the join.
      let laneEndsHere = primaryParent == null;
      if (!laneEndsHere && primaryParent) {
        const otherLane = lanesAfter.findIndex(
          (h, idx) => idx !== laneIndex && h === primaryParent
        );
        if (otherLane !== -1) {
          routes.push({
            fromColumn: laneIndex,
            toColumn: otherLane,
            color: laneColors[otherLane] || color,
            isMerge: true,
          });
          lanesAfter[laneIndex] = null;
          laneEndsHere = true;
        }
      }

      // De-duplicate lanes that point to the same next hash (common ancestor).
      // Keep the left-most lane and clear the rest.
      const seenNextHashes = new Set<string>();
      for (let i = 0; i < lanesAfter.length; i++) {
        const h = lanesAfter[i];
        if (!h) continue;
        if (seenNextHashes.has(h)) {
          lanesAfter[i] = null;
          continue;
        }
        seenNextHashes.add(h);
      }

      // Vertical lines should only appear from the top of the row if that lane
      // already existed in the previous row. This prevents “ghost” lines before
      // the first commit on a branch.
      lanesBefore.forEach((hash, col) => {
        if (!hash) return;
        const isCommitLane = col === laneIndex;
        const endY = isCommitLane && laneEndsHere ? DOT_Y : "100%";

        routes.push({
          fromColumn: col,
          toColumn: col,
          color: laneColors[col] || branchColors[0],
          startY: 0,
          endY,
        });
      });

      // If this commit starts a new lane (no incoming line), and it has a parent,
      // continue the lane *from the dot downward*.
      if (!laneHadIncoming && primaryParent != null && !laneEndsHere) {
        routes.push({
          fromColumn: laneIndex,
          toColumn: laneIndex,
          color,
          startY: DOT_Y,
          endY: "100%",
        });
      }

      // Merge lines from this commit lane to secondary parent lanes.
      if (commit.isMerge && parentLaneIndexes.length > 0) {
        for (const parentLane of parentLaneIndexes) {
          routes.push({
            fromColumn: laneIndex,
            toColumn: parentLane,
            color: laneColors[parentLane] || color,
            isMerge: true,
          });
        }
      }

      lanes = lanesAfter;

      nodes.push({
        commit,
        column: laneIndex,
        color,
        routes,
      });
    }

    return nodes;
  }, [commits, branchColors]);

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

  const getFileIcon = (type: string) => {
    switch (type) {
      case "added":
        return <Plus className="h-4 w-4 text-green-500" />;
      case "deleted":
        return <Minus className="h-4 w-4 text-red-500" />;
      default:
        return <FileText className="h-4 w-4 text-blue-500" />;
    }
  };

  const toggleCommit = (hash: string) => {
    setExpandedCommit(expandedCommit === hash ? null : hash);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Commit History</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {commits.length} commits on {defaultBranch}
          </p>
        </div>
      </div>

      {/* Graph Timeline */}
      {commits.length === 0 ? (
        <EmptyState
          icon={GitCommit}
          title="No commits found"
          description={`We couldn't find any commits on branch ${defaultBranch} in this repository.`}
        />
      ) : (
        <div className="relative overflow-x-auto">
        <div className="space-y-0 min-w-max">
          {graphNodes.map((node, index) => {
            const { commit, column, color, routes } = node;
            const isExpanded = expandedCommit === commit.hash;

            const displayRefs = getDisplayRefs(commit);
            const prevDisplayRefs =
              index > 0 ? getDisplayRefs(graphNodes[index - 1].commit) : [];
            const shouldShowRefs =
              index === 0 ||
              displayRefs.join("|") !== prevDisplayRefs.join("|") ||
              commit.isMerge ||
              (commit.tags?.length ?? 0) > 0;

            // Calculate max column for SVG width
            const maxColumn = Math.max(
              column,
              ...routes.map((r) => Math.max(r.fromColumn, r.toColumn))
            );
            const svgWidth = (maxColumn + 2) * 16 + 20;

            return (
              <div
                key={commit.hash}
                className="relative flex items-stretch min-w-max"
              >
                {/* Graph visualization */}
                <div
                  className="relative flex-shrink-0"
                  style={{
                    width: `${Math.max(svgWidth, 120)}px`,
                    minHeight: "50px",
                  }}
                >
                  <svg
                    width="100%"
                    height="100%"
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ overflow: "visible" }}
                  >
                    {/* Draw all routes */}
                    {routes.map((route, routeIndex) => {
                      const fromX = 20 + route.fromColumn * 16;
                      const toX = 20 + route.toColumn * 16;

                      if (route.isMerge) {
                        // Merge line - curved then vertical continuation
                        const controlY = 25;
                        return (
                          <g key={`route-${routeIndex}`}>
                            <path
                              d={`M ${fromX} ${DOT_Y} Q ${(fromX + toX) / 2} ${controlY}, ${toX} ${CURVE_END_Y}`}
                              stroke={route.color}
                              strokeWidth="2"
                              fill="none"
                              opacity="0.7"
                            />
                            <line
                              x1={toX}
                              y1={CURVE_END_Y}
                              x2={toX}
                              y2="100%"
                              stroke={route.color}
                              strokeWidth="2"
                              opacity="0.7"
                            />
                          </g>
                        );
                      } else if (route.fromColumn === route.toColumn) {
                        // Straight line through the full row
                        return (
                          <line
                            key={`route-${routeIndex}`}
                            x1={fromX}
                            y1={route.startY ?? 0}
                            x2={toX}
                            y2={route.endY ?? "100%"}
                            stroke={route.color}
                            strokeWidth="2.5"
                          />
                        );
                      } else {
                        // Branch line - curved then vertical continuation
                        const controlY = 25;
                        return (
                          <g key={`route-${routeIndex}`}>
                            <path
                              d={`M ${fromX} ${DOT_Y} Q ${fromX} ${controlY}, ${toX} ${CURVE_END_Y}`}
                              stroke={route.color}
                              strokeWidth="2"
                              fill="none"
                              opacity="0.7"
                              strokeDasharray={"3,3"}
                            />
                            <line
                              x1={toX}
                              y1={CURVE_END_Y}
                              x2={toX}
                              y2="100%"
                              stroke={route.color}
                              strokeWidth="2"
                              opacity="0.7"
                              strokeDasharray={"3,3"}
                            />
                          </g>
                        );
                      }
                    })}

                    {/* Commit dot */}
                    <circle
                      cx={20 + column * 16}
                      cy={DOT_Y}
                      r="4"
                      fill={color}
                      stroke="white"
                      strokeWidth="2"
                    />

                    {/* Merge indicator - double circle */}
                    {commit.isMerge && (
                      <>
                        <circle
                          cx={20 + column * 16}
                          cy={DOT_Y}
                          r="7"
                          fill="none"
                          stroke={color}
                          strokeWidth="1.5"
                          opacity="0.6"
                        />
                        <circle
                          cx={20 + column * 16}
                          cy={DOT_Y}
                          r="10"
                          fill="none"
                          stroke={color}
                          strokeWidth="1"
                          opacity="0.3"
                        />
                      </>
                    )}
                  </svg>
                </div>

                {/* Commit content */}
                <div className="flex-1 min-w-0 mb-3">
                  <div
                    className="hover:bg-white/5 transition-all duration-200 rounded-lg cursor-pointer p-3 -ml-2"
                    onClick={() => toggleCommit(commit.hash)}
                  >
                    {/* Commit header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {/* Branch label - only show on first commit of branch or important commits */}
                          {shouldShowRefs &&
                            displayRefs.map((ref) => (
                              <span
                                key={ref}
                                className="px-2 py-0.5 rounded text-xs font-semibold text-white shadow-sm"
                                style={{ backgroundColor: color }}
                              >
                                {refToBadgeText(ref)}
                              </span>
                            ))}

                          {/* Tags */}
                          {commit.tags?.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded text-xs font-semibold bg-yellow-600 text-white border border-yellow-500"
                            >
                              <Tag className="h-3 w-3 inline mr-1" />
                              {tag}
                            </span>
                          ))}

                          {/* Merge indicator */}
                          {commit.isMerge && (
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-600 text-white">
                              <GitMerge className="h-3 w-3 inline mr-1" />
                              Merge
                            </span>
                          )}
                        </div>

                        <div className="flex items-start gap-2">
                          {/* Commit message */}
                          <span className="font-medium text-sm flex-1">
                            {commit.message}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span className="font-mono bg-muted/30 px-1.5 py-0.5 rounded">
                            {commit.shortHash}
                          </span>
                          <span>•</span>
                          <span>{commit.author.name}</span>
                          <span>•</span>
                          <span>{formatDate(commit.timestamp)}</span>
                          {(commit.additions > 0 || commit.deletions > 0) && (
                            <>
                              <span>•</span>
                              <span className="text-green-500">
                                +{commit.additions}
                              </span>
                              <span className="text-red-500">
                                -{commit.deletions}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-white/10 space-y-3 animate-fade-in-up">
                        {commit.description && (
                          <p className="text-sm text-muted-foreground">
                            {commit.description}
                          </p>
                        )}

                        {/* File changes */}
                        {commit.fileChanges.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                              Changed {commit.filesChanged} file
                              {commit.filesChanged !== 1 ? "s" : ""}
                            </h4>
                            <div className="space-y-1">
                              {commit.fileChanges.map((file, fileIndex) => (
                                <div
                                  key={fileIndex}
                                  className="flex items-center justify-between p-2 glass rounded hover:bg-white/10 transition-colors"
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {getFileIcon(file.type)}
                                    <span className="font-mono text-xs truncate">
                                      {file.path}
                                    </span>
                                    {file.type === "added" && (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-semibold">
                                        NEW
                                      </span>
                                    )}
                                    {file.type === "deleted" && (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-semibold">
                                        DEL
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs font-mono">
                                    {file.additions > 0 && (
                                      <span className="text-green-500">
                                        +{file.additions}
                                      </span>
                                    )}
                                    {file.deletions > 0 && (
                                      <span className="text-red-500">
                                        -{file.deletions}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      )}
    </div>
  );
};
