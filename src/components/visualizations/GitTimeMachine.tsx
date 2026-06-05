"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import Image from "next/image";
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Minus,
  Activity,
  Clock,
  Sparkles,
  GitCommit,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sliders,
  Calendar,
  User,
} from "lucide-react";
import { Card } from "@/components/ui";

interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  type: "added" | "modified" | "deleted";
}

interface Commit {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  message: string;
  description?: string;
  committedAt: string;
  branch: string;
  filesChanged: number;
  additions: number;
  deletions: number;
  fileChanges: FileChange[];
}

interface GitTimeMachineProps {
  repository: any;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string; // full path
  name: string; // file/folder name
  type: "file" | "dir";
  status?: "added" | "modified" | "deleted";
  additions?: number;
  deletions?: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

export function GitTimeMachine({ repository }: GitTimeMachineProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const coordinateCacheRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Normalize commits ascending chronologically
  const sortedCommits = useMemo(() => {
    if (!repository?.commits) return [];
    
    const mapped: Commit[] = repository.commits.map((commit: any) => ({
      hash: commit.hash,
      shortHash: commit.shortHash,
      authorName: commit.authorName || "Unknown Author",
      authorEmail: commit.authorEmail || "",
      message: commit.message,
      description: commit.description,
      committedAt: commit.committedAt,
      branch: commit.branch,
      filesChanged: commit.filesChanged || 0,
      additions: commit.additions || 0,
      deletions: commit.deletions || 0,
      fileChanges:
        commit.fileChanges?.map((fc: any) => ({
          path: fc.path,
          additions: fc.additions || 0,
          deletions: fc.deletions || 0,
          type: (fc.changeType || "modified").toLowerCase() as "added" | "modified" | "deleted",
        })) || [],
    }));

    return mapped.sort(
      (a, b) => new Date(a.committedAt).getTime() - new Date(b.committedAt).getTime()
    );
  }, [repository]);

  const [activeCommitIndex, setActiveCommitIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // multipliers: 0.5x, 1x, 2x, 5x
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const activeCommit = sortedCommits[activeCommitIndex] || null;

  // Build the virtual file tree state up to the active commit
  const graphData = useMemo(() => {
    if (sortedCommits.length === 0) return { nodes: [], links: [] };

    const nodesMap = new Map<string, GraphNode>();
    const linksSet = new Set<string>();

    const addDirNode = (dirPath: string) => {
      if (!dirPath || dirPath === ".") return;
      if (nodesMap.has(dirPath)) return;

      const parts = dirPath.split("/");
      const name = parts[parts.length - 1];

      const parentPath = parts.slice(0, -1).join("/");
      if (parentPath) {
        addDirNode(parentPath);
        linksSet.add(`${parentPath}->${dirPath}`);
      }

      nodesMap.set(dirPath, {
        id: dirPath,
        name,
        type: "dir",
      });
    };

    // Reconstruct history chronologically up to the active commit index
    for (let i = 0; i <= activeCommitIndex; i++) {
      const commit = sortedCommits[i];
      if (!commit) continue;

      const isCurrentCommit = i === activeCommitIndex;

      commit.fileChanges.forEach((change) => {
        const path = change.path;
        if (!path) return;

        const parts = path.split("/");
        const filename = parts[parts.length - 1];
        const parentPath = parts.slice(0, -1).join("/");

        if (change.type === "deleted") {
          nodesMap.delete(path);
          if (parentPath) {
            linksSet.delete(`${parentPath}->${path}`);
          }
        } else {
          // added or modified
          if (parentPath) {
            addDirNode(parentPath);
            linksSet.add(`${parentPath}->${path}`);
          }

          nodesMap.set(path, {
            id: path,
            name: filename,
            type: "file",
            status: isCurrentCommit ? change.type : undefined,
            additions: isCurrentCommit ? change.additions : undefined,
            deletions: isCurrentCommit ? change.deletions : undefined,
          });
        }
      });

      // Maintain ghosts for deleted files on the active commit index for visualization
      if (isCurrentCommit) {
        commit.fileChanges.forEach((change) => {
          if (change.type === "deleted") {
            const path = change.path;
            const parts = path.split("/");
            const filename = parts[parts.length - 1];
            const parentPath = parts.slice(0, -1).join("/");

            nodesMap.set(path, {
              id: path,
              name: filename,
              type: "file",
              status: "deleted",
              additions: change.additions,
              deletions: change.deletions,
            });

            if (parentPath) {
              linksSet.add(`${parentPath}->${path}`);
            }
          }
        });
      }
    }

    // Dynamic folder pruning: Remove empty folders
    let foldersPruned = true;
    while (foldersPruned) {
      foldersPruned = false;
      const activePaths = Array.from(nodesMap.keys());
      const directories = Array.from(nodesMap.values()).filter((n) => n.type === "dir");

      for (const dir of directories) {
        const hasChildren = activePaths.some((p) => p !== dir.id && p.startsWith(dir.id + "/"));
        if (!hasChildren) {
          nodesMap.delete(dir.id);
          const parentPath = dir.id.split("/").slice(0, -1).join("/");
          if (parentPath) {
            linksSet.delete(`${parentPath}->${dir.id}`);
          }
          Array.from(linksSet).forEach((link) => {
            if (link.endsWith(`->${dir.id}`)) {
              linksSet.delete(link);
            }
          });
          foldersPruned = true;
        }
      }
    }

    // Stabilize node coordinates using coordinates cache ref
    const nodes = Array.from(nodesMap.values()).map((node) => {
      const cached = coordinateCacheRef.current.get(node.id);
      if (cached) {
        return { ...node, x: cached.x, y: cached.y };
      } else {
        // Place new node near its parent to prevent layout explosion
        const parts = node.id.split("/");
        const parentPath = parts.slice(0, -1).join("/");
        const parentCached = parentPath ? coordinateCacheRef.current.get(parentPath) : null;
        
        const offsetX = (Math.random() - 0.5) * 30;
        const offsetY = (Math.random() - 0.5) * 30;

        return {
          ...node,
          x: parentCached ? parentCached.x + offsetX : 400 + offsetX,
          y: parentCached ? parentCached.y + offsetY : 300 + offsetY,
        };
      }
    });

    const links: GraphLink[] = Array.from(linksSet).map((l) => {
      const [source, target] = l.split("->");
      return { source, target };
    });

    return { nodes, links };
  }, [sortedCommits, activeCommitIndex]);

  // Interval timer for playback
  useEffect(() => {
    if (!isPlaying) return;

    const baseDelay = 1200;
    const intervalMs = baseDelay / playbackSpeed;

    const interval = setInterval(() => {
      setActiveCommitIndex((prev) => {
        if (prev >= sortedCommits.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, sortedCommits.length]);

  // D3 force simulation logic
  useEffect(() => {
    if (!svgRef.current) return;

    const { nodes, links } = graphData;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Default container size
    const containerWidth = svgRef.current.parentElement?.clientWidth || 800;
    const width = containerWidth;
    const height = 550;

    svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", height);

    // Zoom setup
    const zoomGroup = svg.append("g").attr("class", "zoom-group");
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on("zoom", (event) => {
        zoomGroup.attr("transform", event.transform);
      });

    svg.call(zoom as any);

    // Dynamic color themes (neon palette)
    const nodeColors = {
      dir: "#a855f7",       // Deep Violet
      file: "#3b82f6",      // Neon Blue
      added: "#22c55e",     // Vibrant Emerald
      modified: "#f97316",  // Amber Orange
      deleted: "#ef4444",   // Red Hotspot
    };

    // Prepare simulated nodes and links arrays
    const simNodes = nodes.map((n) => ({ ...n }));
    const simLinks = links.map((l) => ({ ...l }));

    const simulation = d3
      .forceSimulation(simNodes as any)
      .force(
        "link",
        d3
          .forceLink(simLinks)
          .id((d: any) => d.id)
          .distance(85)
          .strength(1.2)
      )
      .force("charge", d3.forceManyBody().strength(-250))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d: any) => (d.type === "dir" ? 26 : 18) + 15))
      .force("x", d3.forceX(width / 2).strength(0.05))
      .force("y", d3.forceY(height / 2).strength(0.05));

    // Glow effects setup
    const defs = svg.append("defs");
    
    // Emerald addition glow
    const filterAdd = defs.append("filter").attr("id", "glow-added").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    filterAdd.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "blur");
    filterAdd.append("feMerge").selectAll("feMergeNode").data(["blur", "SourceGraphic"]).join("feMergeNode").attr("in", (d) => d);

    // Orange modified glow
    const filterMod = defs.append("filter").attr("id", "glow-modified").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    filterMod.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "blur");
    filterMod.append("feMerge").selectAll("feMergeNode").data(["blur", "SourceGraphic"]).join("feMergeNode").attr("in", (d) => d);

    // Render connection links
    const link = zoomGroup
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(simLinks)
      .join("line")
      .attr("stroke", "rgba(255, 255, 255, 0.12)")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.65);

    // Render nodes
    const node = zoomGroup
      .append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(simNodes)
      .join("g")
      .style("cursor", "pointer")
      .call(
        d3
          .drag<any, any>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.2).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Outer visual effect circles (halos & pulses for active updates)
    node
      .append("circle")
      .attr("class", "halo")
      .attr("r", (d: any) => (d.type === "dir" ? 22 : 15) + 4)
      .attr("fill", "none")
      .attr("stroke", (d: any) => {
        if (d.status === "added") return nodeColors.added;
        if (d.status === "modified") return nodeColors.modified;
        if (d.status === "deleted") return nodeColors.deleted;
        return "none";
      })
      .attr("stroke-width", 2)
      .attr("stroke-opacity", (d: any) => (d.status ? 0.8 : 0))
      .attr("filter", (d: any) => {
        if (d.status === "added") return "url(#glow-added)";
        if (d.status === "modified") return "url(#glow-modified)";
        return null;
      });

    // Core node elements
    node
      .append("circle")
      .attr("r", (d: any) => (d.type === "dir" ? 18 : 12))
      .attr("fill", (d: any) => {
        if (d.status === "added") return nodeColors.added;
        if (d.status === "modified") return nodeColors.modified;
        if (d.status === "deleted") return nodeColors.deleted;
        return d.type === "dir" ? nodeColors.dir : nodeColors.file;
      })
      .attr("stroke", "rgba(255, 255, 255, 0.45)")
      .attr("stroke-width", 1.5)
      .on("mouseenter", function (event: any, d: any) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("r", (d.type === "dir" ? 21 : 15))
          .attr("stroke", "rgba(255, 255, 255, 0.95)")
          .attr("stroke-width", 2);

        // Fade out un-connected paths
        link
          .transition()
          .duration(150)
          .attr("stroke", (l: any) =>
            l.source.id === d.id || l.target.id === d.id ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.05)"
          )
          .attr("stroke-width", (l: any) =>
            l.source.id === d.id || l.target.id === d.id ? 2.5 : 1
          );

        // Tooltip rendering – use textContent for user-derived strings
        // to prevent XSS from repository file/dir names.
        if (tooltipRef.current) {
          const tooltip = d3.select(tooltipRef.current);
          const additionText = d3.format("+d")(d.additions || 0);
          const deletionText = d3.format("-d")(d.deletions || 0);

          // Escape HTML entities in user-derived strings
          const escapeHtml = (str: string) =>
            str
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");

          const safeName = escapeHtml(String(d.name ?? ""));
          const safeId = escapeHtml(String(d.id ?? ""));

          let changeMetaHtml = "";
          if (d.status === "added") {
            changeMetaHtml = `<span class="px-1.5 py-0.5 rounded text-[10px] bg-green-500/20 text-green-400 font-bold ml-2">NEW</span>`;
          } else if (d.status === "modified") {
            changeMetaHtml = `<span class="px-1.5 py-0.5 rounded text-[10px] bg-orange-500/20 text-orange-400 font-bold ml-2">MODIFIED</span>`;
          } else if (d.status === "deleted") {
            changeMetaHtml = `<span class="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 font-bold ml-2">DELETED</span>`;
          }

          tooltip
            .style("opacity", "1")
            .style("display", "block")
            .style("left", `${event.clientX}px`)
            .style("top", `${event.clientY}px`).html(`
              <div class="space-y-1.5">
                <div class="flex items-center">
                  <div class="font-semibold text-xs text-white truncate max-w-[200px]">${safeName}</div>
                  ${changeMetaHtml}
                </div>
                <div class="text-[10px] text-gray-400 font-mono break-all max-w-[250px]">${safeId}</div>
                <div class="text-[10px] text-gray-500 capitalize font-medium">${d.type === "dir" ? "Directory" : "File"}</div>
                ${
                  d.status && (d.additions > 0 || d.deletions > 0)
                    ? `<div class="flex items-center gap-2 text-[10px] font-mono mt-1">
                        ${d.additions > 0 ? `<span class="text-green-500">${additionText}</span>` : ""}
                        ${d.deletions > 0 ? `<span class="text-red-500">${deletionText}</span>` : ""}
                       </div>`
                    : ""
                }
              </div>
            `);
        }
      })
      .on("mousemove", function (event: any) {
        if (tooltipRef.current) {
          d3.select(tooltipRef.current)
            .style("left", `${event.clientX + 15}px`)
            .style("top", `${event.clientY + 15}px`);
        }
      })
      .on("mouseleave", function (_event: any, d: any) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("r", (d.type === "dir" ? 18 : 12))
          .attr("stroke", "rgba(255, 255, 255, 0.45)")
          .attr("stroke-width", 1.5);

        link
          .transition()
          .duration(150)
          .attr("stroke", "rgba(255, 255, 255, 0.12)")
          .attr("stroke-width", 1.5);

        if (tooltipRef.current) {
          d3.select(tooltipRef.current)
            .style("opacity", "0")
            .style("display", "none");
        }
      })
      .on("click", (_event: any, d: any) => {
        setSelectedNode(d);
      });

    // Custom text labels on nodes
    node
      .append("text")
      .text((d: any) => (d.type === "dir" || d.status ? d.name : ""))
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .attr("dx", 0)
      .attr("dy", (d: any) => (d.type === "dir" ? 34 : 26))
      .attr("text-anchor", "middle")
      .attr("fill", "rgba(255, 255, 255, 0.95)")
      .attr("pointer-events", "none")
      .attr("class", "node-label");

    // Dynamic simulations tick functions
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);

      // Keep cache synced with current positions
      simNodes.forEach((n: any) => {
        if (n.x != null && n.y != null) {
          coordinateCacheRef.current.set(n.id, { x: n.x, y: n.y });
        }
      });
    });

    // Zoom Controls Utility Functions
    d3.select("#zoom-in").on("click", () => {
      svg.transition().duration(250).call(zoom.scaleBy as any, 1.3);
    });

    d3.select("#zoom-out").on("click", () => {
      svg.transition().duration(250).call(zoom.scaleBy as any, 1 / 1.3);
    });

    d3.select("#zoom-reset").on("click", () => {
      svg.transition().duration(350).call(zoom.transform as any, d3.zoomIdentity);
    });

    return () => {
      simulation.stop();
    };
  }, [graphData]);

  // Utility formatter functions
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleReset = () => {
    setIsPlaying(false);
    setActiveCommitIndex(0);
  };

  // Speed controls configuration
  const speeds = [0.5, 1, 2, 5];

  if (sortedCommits.length === 0) {
    return (
      <Card className="glass p-6 text-center text-muted-foreground">
        <GitCommit className="h-10 w-10 mx-auto opacity-30 mb-3" />
        <p className="text-sm">No commit logs found. Try analyzing the repository first.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overview stats header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary animate-pulse" />
            Git Time Machine & Repo Evolution Player
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Observe file expansion, directories creation, and hotspots editing chronologically.
          </p>
        </div>

        {/* Action icons bar */}
        <div className="flex items-center gap-3">
          <div className="glass px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Active State: <strong>{activeCommitIndex + 1}</strong> / {sortedCommits.length} Commits</span>
          </div>

          <div className="flex items-center glass p-0.5 rounded-lg shadow-inner">
            <button
              id="zoom-in"
              title="Zoom In"
              className="p-2 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              id="zoom-out"
              title="Zoom Out"
              className="p-2 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              id="zoom-reset"
              title="Fit Screen"
              className="p-2 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="relative grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Graph rendering area */}
        <div className="xl:col-span-3 glass rounded-xl relative overflow-hidden bg-black/45 border border-white/5 min-h-[500px]">
          <svg ref={svgRef} className="w-full h-full text-white" />

          {/* Glowing neon halo indicator overlay */}
          <div className="absolute top-4 left-4 pointer-events-none space-y-2 text-xs">
            <div className="glass backdrop-blur-md px-3 py-2 rounded-lg border border-white/5 space-y-1">
              <span className="font-semibold text-gray-300 block mb-1">Graph Legend</span>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <span className="text-gray-400">Folders</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-gray-400">Files</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-gray-400">Newly Added Files</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-gray-400">Hotspot (Modified)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-gray-400">Deleted (Ghost Nodes)</span>
              </div>
            </div>
          </div>

          {/* Hover micro-tooltip */}
          <div
            ref={tooltipRef}
            className="fixed p-3 rounded-lg pointer-events-none shadow-2xl border border-white/10 translate-x-3 translate-y-3 hidden"
            style={{
              opacity: 0,
              backgroundColor: "rgba(10, 10, 10, 0.95)",
              color: "white",
              zIndex: 9999,
              backdropFilter: "blur(12px)",
              maxWidth: "280px",
            }}
          />
        </div>

        {/* HUD card dashboard display details (right side) */}
        <div className="xl:col-span-1 space-y-4">
          <Card className="glass border-white/10 p-5 bg-white/[0.02] shadow-2xl space-y-4 flex flex-col justify-between h-full">
            <div className="space-y-4">
              <div className="border-b border-white/10 pb-3 flex items-center justify-between">
                <h3 className="font-bold text-sm tracking-wide uppercase text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                  Active Commit HUD
                </h3>
                <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                  {activeCommit?.shortHash}
                </span>
              </div>

              {activeCommit ? (
                <div className="space-y-3.5 text-xs animate-fade-in-up">
                  {/* Author detail info */}
                  <div className="flex items-center gap-2.5">
                    <Image
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${activeCommit.authorName}`}
                      alt={activeCommit.authorName}
                      width={36}
                      height={36}
                      className="h-9 w-9 rounded-full bg-white/10 p-0.5 border border-white/20 shadow-md glow-author"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {activeCommit.authorName}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">{activeCommit.authorEmail}</div>
                    </div>
                  </div>

                  {/* Date details */}
                  <div className="flex items-center gap-2 text-muted-foreground text-[11px] bg-white/5 p-2 rounded-lg">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{formatDate(activeCommit.committedAt)}</span>
                  </div>

                  {/* Message displays */}
                  <div className="space-y-1 bg-black/25 p-3 rounded-lg border border-white/5">
                    <span className="text-[10px] uppercase text-muted-foreground tracking-wider block font-bold">Commit Message</span>
                    <p className="text-gray-200 text-xs font-medium leading-relaxed break-words">{activeCommit.message}</p>
                    {activeCommit.description && (
                      <p className="text-gray-400 text-[10px] mt-1 italic break-words">{activeCommit.description}</p>
                    )}
                  </div>

                  {/* Stats Counter metrics */}
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                    <div className="glass bg-white/5 p-2 rounded-lg">
                      <div className="font-bold text-gray-300 text-sm">{activeCommit.filesChanged}</div>
                      <div className="text-gray-500 uppercase font-semibold text-[8px] mt-0.5">Files</div>
                    </div>
                    <div className="glass bg-green-500/5 p-2 rounded-lg border border-green-500/10">
                      <div className="font-bold text-green-400 text-sm flex items-center justify-center gap-0.5">
                        <Plus className="h-3 w-3" />
                        {activeCommit.additions}
                      </div>
                      <div className="text-green-500/80 uppercase font-semibold text-[8px] mt-0.5">Additions</div>
                    </div>
                    <div className="glass bg-red-500/5 p-2 rounded-lg border border-red-500/10">
                      <div className="font-bold text-red-400 text-sm flex items-center justify-center gap-0.5">
                        <Minus className="h-3 w-3" />
                        {activeCommit.deletions}
                      </div>
                      <div className="text-red-500/80 uppercase font-semibold text-[8px] mt-0.5">Deletions</div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Gathering history data...</p>
              )}
            </div>

            {/* Selected Node Inspector panel details */}
            {selectedNode && (
              <div className="border-t border-white/10 pt-3 mt-4 space-y-2 animate-fade-in-up text-xs">
                <div className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Node Inspector</div>
                <div className="bg-white/5 p-2.5 rounded-lg space-y-1 border border-white/5 relative">
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="absolute top-2 right-2 text-muted-foreground hover:text-white text-[10px]"
                  >
                    Close
                  </button>
                  <div className="font-semibold text-white truncate max-w-[170px]">{selectedNode.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate font-mono">{selectedNode.id}</div>
                  <div className="text-[9px] text-gray-500 capitalize">{selectedNode.type === "dir" ? "Directory" : "File"}</div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Interactive visual glass console controllers (playbacks) */}
      <div className="glass rounded-xl p-4 sm:p-5 border border-white/10 bg-white/[0.01] shadow-2xl space-y-4">
        {/* Scrubber scroll bar progress timelines */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono text-muted-foreground px-1">
            <span>Earliest Chronological Commit</span>
            <span className="text-primary font-bold">{activeCommitIndex + 1} / {sortedCommits.length}</span>
            <span>Latest Commit</span>
          </div>

          <div className="relative group flex items-center">
            <input
              type="range"
              min="0"
              max={sortedCommits.length - 1}
              value={activeCommitIndex}
              onChange={(e) => {
                setIsPlaying(false);
                setActiveCommitIndex(parseInt(e.target.value));
              }}
              className="w-full h-2 rounded-lg cursor-pointer bg-white/10 accent-primary focus:outline-none transition-all duration-300 relative z-10"
              style={{
                background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${
                  (activeCommitIndex / (sortedCommits.length - 1 || 1)) * 100
                }%, rgba(255, 255, 255, 0.1) ${
                  (activeCommitIndex / (sortedCommits.length - 1 || 1)) * 100
                }%, rgba(255, 255, 255, 0.1) 100%)`,
              }}
            />
          </div>
        </div>

        {/* Main button playbacks triggers and speeds metrics toggles */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
          {/* Audio triggers controllers panels */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`
                px-4 py-2.5 rounded-lg font-semibold flex items-center gap-2 transition-all duration-300 shadow-md
                ${
                  isPlaying
                    ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20"
                    : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20"
                }
              `}
            >
              {isPlaying ? (
                <>
                  <Pause className="h-4.5 w-4.5 fill-current animate-pulse" />
                  <span>Pause playback</span>
                </>
              ) : (
                <>
                  <Play className="h-4.5 w-4.5 fill-current" />
                  <span>Play history</span>
                </>
              )}
            </button>

            <button
              onClick={handleReset}
              title="Reset Timeline to Earliest"
              className="p-2.5 rounded-lg glass text-muted-foreground hover:text-white transition-all duration-300 animate-fade-in"
            >
              <RotateCcw className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Speed triggers control toggles buttons */}
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-primary animate-pulse" />
              Speed Multiplier:
            </span>
            <div className="glass p-1 rounded-lg flex items-center gap-1">
              {speeds.map((s) => (
                <button
                  key={s}
                  onClick={() => setPlaybackSpeed(s)}
                  className={`
                    px-2.5 py-1 rounded text-xs font-mono font-bold transition-all duration-200
                    ${
                      playbackSpeed === s
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    }
                  `}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
