"use client";

import { useEffect, useRef, useState, Fragment } from "react";
import axios from "axios";
import { buildApiUrl } from "@/services/apiConfig";
import { useToast } from "@/hooks/use-toast";
import * as d3 from "d3";
import {
  TrendingUp,
  Activity,
  Sparkles,
  AlertTriangle,
  GitBranch,
  Calendar,
  Maximize2,
  RefreshCw,
  FileCode,
  ArrowRightLeft,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
import { Card, Button } from "@/components/ui";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface RepositoryEvolutionDashboardProps {
  repository: any;
}

function renderBoldText(text: string) {
  const parts = text.split("**");
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return (
        <strong key={index} className="font-bold text-white">
          {part}
        </strong>
      );
    }
    return part;
  });
}

export function RepositoryEvolutionDashboard({
  repository,
}: RepositoryEvolutionDashboardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [evolutionData, setEvolutionData] = useState<any>(null);
  const [selectedSnapshotA, setSelectedSnapshotA] = useState<string>("");
  const [selectedSnapshotB, setSelectedSnapshotB] = useState<string>("");
  
  const [activeSubTab, setActiveSubTab] = useState<"timeline" | "compare" | "coupling" | "ai">("timeline");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // References for D3 graphs in comparison view
  const [svgElA, setSvgElA] = useState<SVGSVGElement | null>(null);
  const [svgElB, setSvgElB] = useState<SVGSVGElement | null>(null);

  useEffect(() => {
    fetchEvolutionData();
  }, [repository.id]);

  const fetchEvolutionData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("gitverse_token");
      const res = await axios.get(
        buildApiUrl(`/api/repositories/${repository.id}/evolution`),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setEvolutionData(res.data);

      const snaps = res.data.snapshots || [];
      if (snaps.length > 0) {
        // Default select last snapshot as B, and second last (or first) as A
        setSelectedSnapshotB(snaps[snaps.length - 1].commitHash);
        if (snaps.length > 1) {
          setSelectedSnapshotA(snaps[snaps.length - 2].commitHash);
        } else {
          setSelectedSnapshotA(snaps[0].commitHash);
        }
      }
    } catch (err: any) {
      console.error("Error loading evolution data:", err);
      toast({
        title: "Error loading analytics",
        description: err.response?.data?.error || "Failed to load evolution tracking data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAiReport = async () => {
    try {
      setIsGeneratingAi(true);
      const token = localStorage.getItem("gitverse_token");
      const res = await axios.post(
        buildApiUrl(`/api/repositories/${repository.id}/evolution/analyze-ai`),
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setEvolutionData((prev: any) => ({
        ...prev,
        aiInsights: res.data.aiInsights,
      }));
      toast({
        title: "Report Generated!",
        description: "AI-powered architecture analysis has been compiled.",
      });
    } catch (err: any) {
      console.error("AI Generation failed:", err);
      toast({
        title: "AI Generation Failed",
        description: err.response?.data?.error || "Unable to generate insights.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Build timeline chart data
  const timelineChartData = (evolutionData?.snapshots || []).map((snap: any) => {
    const meta = snap.metadata || {};
    return {
      name: snap.tagName || snap.commitHash.substring(0, 7),
      date: new Date(snap.committedAt).toLocaleDateString(),
      files: meta.totalFiles || 0,
      lines: meta.totalLines || 0,
      sizeKb: Math.round((meta.totalSize || 0) / 1024),
      commitHash: snap.commitHash,
    };
  });

  // Calculate snapshot diffs for comparison
  const snapA = (evolutionData?.snapshots || []).find(
    (s: any) => s.commitHash === selectedSnapshotA
  );
  const snapB = (evolutionData?.snapshots || []).find(
    (s: any) => s.commitHash === selectedSnapshotB
  );

  useEffect(() => {
    if (activeSubTab !== "compare" || !snapA || !snapB || !svgElA || !svgElB) return;
    
    renderDiffGraph(svgElA, snapA, snapB, "left");
    renderDiffGraph(svgElB, snapB, snapA, "right");
  }, [activeSubTab, selectedSnapshotA, selectedSnapshotB, evolutionData, svgElA, svgElB]);

  const renderDiffGraph = (
    svgElement: SVGSVGElement | null,
    currentSnap: any,
    compareSnap: any,
    side: "left" | "right"
  ) => {
    if (!svgElement) return;

    // Stop any existing simulation on this element to prevent overlapping tick loops
    if ((svgElement as any).__simulation) {
      (svgElement as any).__simulation.stop();
    }

    const svg = d3.select(svgElement);
    svg.selectAll("*").remove();

    const currentGraph = currentSnap.dependencyGraph || {};
    const compareGraph = compareSnap.dependencyGraph || {};

    const currentFiles = Object.keys(currentGraph);
    const compareFiles = Object.keys(compareGraph);

    if (currentFiles.length === 0) {
      svg
        .append("text")
        .attr("x", "50%")
        .attr("y", "50%")
        .attr("text-anchor", "middle")
        .attr("fill", "rgba(255,255,255,0.4)")
        .text("Empty Snapshot Graph");
      return;
    }

    // Standardize nodes for visualization (limit to top 15 files to avoid clutter)
    const sortedFiles = [...currentFiles].slice(0, 15);
    const nodes = sortedFiles.map((file) => {
      const isNew = side === "right" && !compareFiles.includes(file);
      const isDeleted = side === "left" && !compareFiles.includes(file);

      let color = "#3b82f6"; // normal file
      if (isNew) color = "#10b981"; // added file
      if (isDeleted) color = "#ef4444"; // removed file

      return {
        id: file,
        name: file.split("/").pop() || file,
        color,
        size: 15,
      };
    });

    const links: any[] = [];
    sortedFiles.forEach((file) => {
      const imports = currentGraph[file] || [];
      imports.forEach((imp: string) => {
        if (sortedFiles.includes(imp)) {
          // Check if link exists in compareSnap
          const wasLinked = compareGraph[file]?.includes(imp);
          const isLinkModified = !wasLinked;

          links.push({
            source: file,
            target: imp,
            color: isLinkModified ? "#f97316" : "rgba(255, 255, 255, 0.2)",
            width: isLinkModified ? 2 : 1,
          });
        }
      });
    });

    const width = 400;
    const height = 280;

    const g = svg.append("g");

    const simulation = d3
      .forceSimulation(nodes as any)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d: any) => d.id)
          .distance(60)
      )
      .force("charge", d3.forceManyBody().strength(-150))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(20));

    // Draw lines
    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d: any) => d.color)
      .attr("stroke-width", (d: any) => d.width)
      .attr("stroke-opacity", 0.6);

    // Draw circles
    const node = g
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(
        d3
          .drag<any, any>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
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

    node
      .append("circle")
      .attr("r", 8)
      .attr("fill", (d: any) => d.color)
      .attr("stroke", "rgba(255,255,255,0.4)")
      .attr("stroke-width", 1);

    node.append("title").text((d: any) => d.id);

    node
      .append("text")
      .text((d: any) =>
        d.name.length > 12 ? d.name.slice(0, 10) + "..." : d.name
      )
      .attr("font-size", "8px")
      .attr("dy", 15)
      .attr("text-anchor", "middle")
      .attr("fill", "#94a3b8");

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 2])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom as any);

    // Store simulation on the SVG element so it can be stopped on re-render
    (svgElement as any).__simulation = simulation;
  };

  if (loading) {
    return (
      <div className="glass rounded-lg p-12 text-center space-y-4">
        <div className="flex justify-center">
          <RefreshCw className="animate-spin h-10 w-10 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Analyzing Repository History</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Loading dependency snapshots and logical coupling heatmaps...
          </p>
        </div>
      </div>
    );
  }

  const snapshots = evolutionData?.snapshots || [];

  if (snapshots.length === 0) {
    return (
      <div className="glass rounded-lg p-12 text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto animate-pulse" />
        <div>
          <h3 className="font-semibold text-lg">No Architecture Snapshots Available</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Please wait for the repository analysis task to complete, which automatically compiles evolution snapshots.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Sub-Tabs */}
      <div className="flex bg-slate-900/60 p-1 rounded-lg border border-white/5 overflow-x-auto gap-1">
        {[
          { id: "timeline", label: "Evolution Timeline", icon: <TrendingUp className="h-4 w-4" /> },
          { id: "compare", label: "Snapshot Comparison", icon: <ArrowRightLeft className="h-4 w-4" /> },
          { id: "coupling", label: "Logical Coupling Heatmap", icon: <Activity className="h-4 w-4" /> },
          { id: "ai", label: "AI Refactoring Insights", icon: <Sparkles className="h-4 w-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap ${
              activeSubTab === tab.id
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Timeline tab */}
        {activeSubTab === "timeline" && (
          <motion.div
            key="timeline"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            <Card className="glass p-6 lg:col-span-2 space-y-6">
              <div>
                <h3 className="text-lg font-bold">Repository Growth Trends</h3>
                <p className="text-sm text-slate-400">
                  Track repository file count, lines of code, and size growth across snapshots
                </p>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineChartData}>
                    <defs>
                      <linearGradient id="colorLines" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorFiles" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                    <YAxis yAxisId="left" stroke="#3b82f6" fontSize={11} label={{ value: 'Lines', angle: -90, position: 'insideLeft', fill: '#3b82f6', style: {fontSize: 10} }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#8b5cf6" fontSize={11} label={{ value: 'Files', angle: 90, position: 'insideRight', fill: '#8b5cf6', style: {fontSize: 10} }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.95)",
                        borderColor: "rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="lines"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorLines)"
                      name="Lines of Code"
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="files"
                      stroke="#8b5cf6"
                      fillOpacity={1}
                      fill="url(#colorFiles)"
                      name="File Count"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="glass p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold">Snapshot History</h3>
                <p className="text-sm text-slate-400">
                  Select and review architectural milestones
                </p>
              </div>

              <div className="space-y-3 overflow-y-auto max-h-[340px] pr-1">
                {snapshots.map((snap: any, index: number) => {
                  const meta = snap.metadata || {};
                  return (
                    <div
                      key={snap.commitHash}
                      className="p-4 rounded-lg bg-slate-950/40 border border-white/5 hover:border-blue-500/30 transition-all duration-200"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                          <GitBranch className="h-3 w-3" />
                          {snap.tagName || snap.commitHash.substring(0, 7)}
                        </span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(snap.committedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-300 mt-2 truncate">
                        {snap.commitMessage}
                      </p>
                      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/5 text-center text-[10px]">
                        <div>
                          <div className="text-slate-500">Files</div>
                          <div className="font-bold text-slate-300">{meta.totalFiles || 0}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Lines</div>
                          <div className="font-bold text-slate-300">{meta.totalLines || 0}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Size</div>
                          <div className="font-bold text-slate-300">
                            {Math.round((meta.totalSize || 0) / 1024)} KB
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Compare tab */}
        {activeSubTab === "compare" && (() => {
          const snapAFiles = snapA ? Object.keys(snapA.dependencyGraph || {}) : [];
          const snapBFiles = snapB ? Object.keys(snapB.dependencyGraph || {}) : [];
          const deletedFiles = snapAFiles.filter(f => !snapBFiles.includes(f));
          const addedFiles = snapBFiles.filter(f => !snapAFiles.includes(f));

          const metaA = snapA?.metadata || {};
          const metaB = snapB?.metadata || {};
          const totalFilesA = metaA.totalFiles || 0;
          const totalFilesB = metaB.totalFiles || 0;
          const totalLinesA = metaA.totalLines || 0;
          const totalLinesB = metaB.totalLines || 0;
          const totalSizeA = metaA.totalSize || 0;
          const totalSizeB = metaB.totalSize || 0;
          const primaryLanguage = metaB.languages?.[0]?.name || "N/A";

          return (
            <motion.div
              key="compare"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <Card className="glass p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-white/5 pb-4">
                  <div>
                    <h3 className="text-lg font-bold">Side-by-Side Snapshot Comparison</h3>
                    <p className="text-sm text-slate-400">
                      Compare dependency structures and trace added or removed files
                    </p>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-950/40 p-2 rounded-lg border border-white/5">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 block uppercase font-bold">
                        Left Box (Base Snapshot)
                      </label>
                      <select
                        value={selectedSnapshotA}
                        onChange={(e) => setSelectedSnapshotA(e.target.value)}
                        className="bg-transparent border-0 text-xs text-slate-300 focus:ring-0 p-0 cursor-pointer"
                      >
                        {snapshots.map((s: any) => (
                          <option key={s.commitHash} value={s.commitHash} className="bg-slate-900">
                            {s.tagName || s.commitHash.substring(0, 7)} - {s.commitMessage.substring(0, 20)}...
                          </option>
                        ))}
                      </select>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 block uppercase font-bold">
                        Right Box (Compare Snapshot)
                      </label>
                      <select
                        value={selectedSnapshotB}
                        onChange={(e) => setSelectedSnapshotB(e.target.value)}
                        className="bg-transparent border-0 text-xs text-slate-300 focus:ring-0 p-0 cursor-pointer"
                      >
                        {snapshots.map((s: any) => (
                          <option key={s.commitHash} value={s.commitHash} className="bg-slate-900">
                            {s.tagName || s.commitHash.substring(0, 7)} - {s.commitMessage.substring(0, 20)}...
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Explanation Banner */}
                <div className="bg-slate-900/80 border border-blue-500/20 rounded-lg p-3.5 text-xs text-slate-300 flex items-start gap-2.5 mb-6">
                  <div className="p-1 rounded bg-blue-500/10 text-blue-400 mt-0.5">
                    <HelpCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-blue-400 block mb-0.5">How to read the Side-by-Side Comparison:</span>
                    <ul className="list-disc pl-4 space-y-1 text-slate-400">
                      <li>
                        <strong className="text-slate-200">Left Box:</strong> Displays the older version structure (Base Snapshot). Files highlighted in <span className="text-red-400 font-semibold font-mono">Red</span> are files that were subsequently deleted in the newer version.
                      </li>
                      <li>
                        <strong className="text-slate-200">Right Box:</strong> Displays the newer version structure (Compare Snapshot). Files highlighted in <span className="text-emerald-400 font-semibold font-mono">Green</span> are new files that did not exist in the older version.
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Side-by-side graphs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="glass bg-slate-950/30 p-4 rounded-lg relative flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[9px]">Left Box (Older Version)</span>
                          {snapA?.tagName || snapA?.commitHash.substring(0, 7)}
                        </span>
                        <span className="text-[10px] text-red-400 font-medium">Red = Deleted in compare</span>
                      </div>
                      <svg ref={setSvgElA} className="w-full min-h-[280px]" viewBox="0 0 400 280" />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2 border-t border-white/5 pt-2 italic text-center">
                      Displays the structure of the older version. Red nodes represent files that were subsequently deleted in the newer version.
                    </p>
                  </div>

                  <div className="glass bg-slate-950/30 p-4 rounded-lg relative flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[9px]">Right Box (Newer Version)</span>
                          {snapB?.tagName || snapB?.commitHash.substring(0, 7)}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-medium">Green = Added since base</span>
                      </div>
                      <svg ref={setSvgElB} className="w-full min-h-[280px]" viewBox="0 0 400 280" />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2 border-t border-white/5 pt-2 italic text-center">
                      Displays the structure of the newer version. Green nodes represent files that are new and did not exist in the older version.
                    </p>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap justify-center gap-6 mt-4 p-3 bg-slate-950/40 rounded-lg border border-white/5 text-[10px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] border border-white/20 inline-block" />
                    <span>Existing File</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] border border-white/20 inline-block" />
                    <span>Added File</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] border border-white/20 inline-block" />
                    <span>Deleted File</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-0.5 bg-slate-500/40 inline-block" />
                    <span>Unchanged Import</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-0.5 bg-[#f97316] inline-block" />
                    <span>New/Modified Import</span>
                  </div>
                </div>

                {/* Comparison Stats */}
                {snapA && snapB && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/5">
                    <div className="p-4 rounded-lg bg-slate-950/20 text-center">
                      <div className="text-xs text-slate-500">File Count Shift</div>
                      <div className="text-lg font-bold mt-1 text-slate-200">
                        {totalFilesA} → {totalFilesB} (
                        {totalFilesB - totalFilesA >= 0 ? "+" : ""}
                        {totalFilesB - totalFilesA})
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-950/20 text-center">
                      <div className="text-xs text-slate-500">Lines Growth</div>
                      <div className="text-lg font-bold mt-1 text-slate-200">
                        {totalLinesA} → {totalLinesB} (
                        {totalLinesB - totalLinesA >= 0 ? "+" : ""}
                        {totalLinesB - totalLinesA})
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-950/20 text-center">
                      <div className="text-xs text-slate-500">Size Change</div>
                      <div className="text-lg font-bold mt-1 text-slate-200">
                        {Math.round(totalSizeA / 1024)} KB → {Math.round(totalSizeB / 1024)} KB
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-950/20 text-center">
                      <div className="text-xs text-slate-500">Primary Language</div>
                      <div className="text-lg font-bold mt-1 text-blue-400">
                        {primaryLanguage}
                      </div>
                    </div>
                  </div>
                )}

                {/* Diff lists */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-white/5">
                  <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/10">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-red-400 mb-2">
                      Deleted Files ({deletedFiles.length})
                    </h4>
                    {deletedFiles.length > 0 ? (
                      <ul className="space-y-1 text-xs text-slate-300 font-mono max-h-40 overflow-y-auto pr-1">
                        {deletedFiles.map(f => (
                          <li key={f} className="truncate text-red-300/80">- {f}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No files deleted.</p>
                    )}
                  </div>

                  <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">
                      Added Files ({addedFiles.length})
                    </h4>
                    {addedFiles.length > 0 ? (
                      <ul className="space-y-1 text-xs text-slate-300 font-mono max-h-40 overflow-y-auto pr-1">
                        {addedFiles.map(f => (
                          <li key={f} className="truncate text-emerald-300/80">+ {f}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No files added.</p>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })()}

        {/* Coupling tab */}
        {activeSubTab === "coupling" && (
          <motion.div
            key="coupling"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Heatmap Grid */}
            <Card className="glass p-6 lg:col-span-2 space-y-6">
              <div>
                <h3 className="text-lg font-bold">Logical Co-Change Matrix</h3>
                <p className="text-sm text-slate-400">
                  Heatmap indicating files modified together frequently. Darker boxes show tight coupling.
                </p>
              </div>

              {evolutionData?.coupling?.files?.length > 0 ? (
                <div className="flex flex-col items-center">
                  <div className="overflow-x-auto w-full max-w-xl">
                    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${evolutionData.coupling.files.length + 1}, minmax(0, 1fr))` }}>
                      {/* Corner empty box */}
                      <div className="h-8 flex items-center justify-center text-[8px] text-slate-500 font-bold truncate p-1">File</div>
                      {/* Column headers */}
                      {evolutionData.coupling.files.map((file: string, i: number) => (
                        <div key={i} className="h-8 flex items-center justify-center text-[8px] text-slate-400 font-bold truncate p-0.5" title={file}>
                          {file.split("/").pop()}
                        </div>
                      ))}

                      {/* Matrix rows */}
                      {evolutionData.coupling.files.map((fileA: string, r: number) => (
                        <Fragment key={r}>
                          {/* Row header */}
                          <div className="h-8 flex items-center text-[8px] text-slate-400 font-bold truncate p-0.5" title={fileA}>
                            {fileA.split("/").pop()}
                          </div>
                          {/* Row cells */}
                          {evolutionData.coupling.files.map((fileB: string, c: number) => {
                            const val = evolutionData.coupling.matrix[r][c];
                            let bg = "bg-slate-950/20";
                            if (val > 0.0) bg = "bg-blue-900/20 text-blue-500";
                            if (val > 0.15) bg = "bg-blue-800/40 text-blue-400";
                            if (val > 0.3) bg = "bg-blue-700/60 text-blue-300";
                            if (val > 0.45) bg = "bg-blue-600/80 text-blue-200 border border-blue-400/20";
                            if (val > 0.6) bg = "bg-indigo-600 text-white font-bold border border-indigo-400/30";

                            return (
                              <div
                                key={c}
                                className={`h-8 flex items-center justify-center rounded-sm text-[9px] cursor-help transition-all duration-150 ${bg}`}
                                title={`${fileA.split("/").pop()} ↔ ${fileB.split("/").pop()}\nCoupling Strength: ${Math.round(val * 100)}%`}
                              >
                                {val > 0 ? `${Math.round(val * 100)}` : "-"}
                              </div>
                            );
                          })}
                        </Fragment>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-4 mt-6 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-slate-950/20 rounded" />
                      <span>0%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-blue-700/60 rounded" />
                      <span>&gt;30% (Medium)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-indigo-600 rounded" />
                      <span>&gt;60% (High Coupling)</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 text-sm">
                  Insufficient multi-file commits to compile coupling heatmap.
                </div>
              )}
            </Card>

            {/* Warning List */}
            <Card className="glass p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold">Tight Coupling Risks</h3>
                <p className="text-sm text-slate-400">
                  Highly coupled file pairs posing modularization drift risks
                </p>
              </div>

              <div className="space-y-3 overflow-y-auto max-h-[340px]">
                {evolutionData?.coupling?.topPairs?.length > 0 ? (
                  evolutionData.coupling.topPairs.slice(0, 10).map((pair: any, index: number) => {
                    const isCritical = pair.strength >= 0.4;
                    return (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border text-xs space-y-1.5 transition-all duration-200 ${
                          isCritical
                            ? "bg-red-500/5 border-red-500/20 hover:border-red-500/40"
                            : "bg-slate-950/20 border-white/5 hover:border-blue-500/20"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-slate-400">Pair #{index + 1}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded-full font-bold text-[9px] ${
                              isCritical
                                ? "bg-red-500/20 text-red-400"
                                : "bg-blue-500/10 text-blue-400"
                            }`}
                          >
                            Strength: {Math.round(pair.strength * 100)}%
                          </span>
                        </div>
                        <div className="space-y-1 py-1 font-mono text-[10px] text-slate-300">
                          <div className="flex items-center gap-1.5 truncate">
                            <FileCode className="h-3.5 w-3.5 text-blue-500" />
                            {pair.fileA}
                          </div>
                          <div className="flex items-center gap-1.5 truncate">
                            <FileCode className="h-3.5 w-3.5 text-indigo-500" />
                            {pair.fileB}
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1.5 border-t border-white/5">
                          <span>Co-changed in {pair.coChanges} commits</span>
                          {isCritical && (
                            <span className="text-red-400 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Redesign Advised
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-slate-500 text-sm">
                    No logical coupling pairs detected.
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {/* AI Insights tab */}
        {activeSubTab === "ai" && (
          <motion.div
            key="ai"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="glass p-6 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
                    AI-Generated Architecture Evolution Report
                  </h3>
                  <p className="text-sm text-slate-400">
                    Gemini-powered software modularity & refactoring suggestions based on git metadata
                  </p>
                </div>

                <Button
                  onClick={handleGenerateAiReport}
                  disabled={isGeneratingAi}
                  variant="outline"
                  className="bg-indigo-600/10 border-indigo-500/20 hover:bg-indigo-600/20 text-indigo-400"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isGeneratingAi ? "animate-spin" : ""}`} />
                  {evolutionData?.aiInsights ? "Regenerate Report" : "Generate Report"}
                </Button>
              </div>

              {isGeneratingAi ? (
                <div className="py-16 text-center space-y-4">
                  <RefreshCw className="animate-spin h-10 w-10 text-indigo-500 mx-auto" />
                  <div className="max-w-xs mx-auto">
                    <h4 className="font-semibold text-slate-300">Compiling Evolution History</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Gemini is scanning timeline changes, Jaccard coupling indexes, and refactoring pathways...
                    </p>
                  </div>
                </div>
              ) : evolutionData?.aiInsights ? (
                <div className="prose prose-invert max-w-none text-slate-300 overflow-y-auto max-h-[500px] pr-2 scrollbar-thin">
                  <ReactMarkdown
                    components={{
                      h1: (props) => (
                        <h1
                          className="text-2xl font-bold text-white mt-6 mb-3"
                          {...props}
                        />
                      ),
                      h2: (props) => (
                        <h2
                          className="text-xl font-bold text-white mt-5 mb-2 border-b border-white/5 pb-1"
                          {...props}
                        />
                      ),
                      h3: (props) => (
                        <h3
                          className="text-lg font-bold text-white mt-4 mb-2"
                          {...props}
                        />
                      ),
                      p: (props) => (
                        <p className="my-3 text-sm leading-relaxed text-slate-300" {...props} />
                      ),
                      ul: (props) => (
                        <ul
                          className="list-disc pl-6 my-2 space-y-1.5 text-slate-300"
                          {...props}
                        />
                      ),
                      ol: (props) => (
                        <ol
                          className="list-decimal pl-6 my-2 space-y-1.5 text-slate-300"
                          {...props}
                        />
                      ),
                      li: (props) => <li className="text-sm leading-relaxed" {...props} />,
                      strong: (props) => <strong className="font-bold text-white" {...props} />,
                      em: (props) => <em className="italic text-slate-300" {...props} />,
                      code: (props) => <code className="px-1 py-0.5 rounded bg-black/30 font-mono text-xs text-indigo-300" {...props} />,
                      pre: (props) => <pre className="p-3 rounded-lg bg-black/30 overflow-auto font-mono text-xs my-3" {...props} />,
                    }}
                  >
                    {evolutionData.aiInsights}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="py-16 text-center space-y-4 glass bg-slate-950/20 rounded-lg">
                  <Sparkles className="h-10 w-10 text-indigo-400 mx-auto" />
                  <div className="max-w-md mx-auto space-y-4">
                    <div>
                      <h4 className="font-semibold text-slate-300">Generate Evolution Report</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Get automated modularization advice, god object warnings, and decoupling workflows tailored specifically to your co-change matrix.
                      </p>
                    </div>
                    <Button
                      onClick={handleGenerateAiReport}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      Analyze Evolution Data
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
