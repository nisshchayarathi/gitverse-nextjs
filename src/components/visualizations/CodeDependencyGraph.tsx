import { useEffect, useRef, useState, useMemo } from "react";
import * as htmlToImage from "html-to-image";
import * as d3 from "d3";
import { Card, Input } from "@/components/ui";
import { GraphAnalyzer } from "@/utils/graphAnalyzer";
import { GraphFilteringService } from "@/services/graphFilteringService";
import { MapControls } from "./MapControls";
import { toast } from "sonner";
import { annotationService, MapAnnotation } from "@/services/annotationService";
import { AnnotationMarker } from "../map/AnnotationMarker";
import { AnnotationPopover } from "../map/AnnotationPopover";
import { AnnotationPanel } from "../map/AnnotationPanel";
import { MessageSquarePlus } from "lucide-react";
import { useGraphDrilldown } from "@/hooks/useGraphDrilldown";
import { useGraphFilters } from "@/hooks/useGraphFilters";
import { FilterPanel } from "../map/FilterPanel";
import { DrilldownControls } from "../map/DrilldownControls";
import { MiniMap } from "../map/MiniMap";
import { TimeTravelTimeline } from "../repository/TimeTravelTimeline";

interface RepositoryFile {
  path: string;
  lines?: number;
}

interface Repository {
  files?: RepositoryFile[];
}

interface CodeDependencyGraphProps {
  repository?: any;
}

export function CodeDependencyGraph({ repository }: CodeDependencyGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const zoomRef = useRef<any>(null);
  const svgSelectionRef = useRef<any>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  
  const [annotations, setAnnotations] = useState<MapAnnotation[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [popover, setPopover] = useState<{ isOpen: boolean, x: number, y: number, initialData?: Partial<MapAnnotation>, targetId?: string, targetType?: 'node'|'edge' } | null>(null);
  const nodesRef = useRef<any[]>([]);
  const linksRef = useRef<any[]>([]);
  const [, setTick] = useState(0);
  
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showFolders, setShowFolders] = useState(true);
  const [showFiles, setShowFiles] = useState(true);
  const [minConnections, setMinConnections] = useState(0);
  const [selectedExtension, setSelectedExtension] = useState<string>("all");

  // Additional refs for tracking D3 selections for transition centering
  const d3SvgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
  const d3GRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const renderedNodesRef = useRef<any[]>([]);

  const selectedCommit = useMemo(() => {
    if (!selectedCommitHash || !repository?.commits) return null;
    return repository.commits.find((c: any) => c.hash === selectedCommitHash || c.shortHash === selectedCommitHash) || null;
  }, [selectedCommitHash, repository?.commits]);

  const changedFiles = useMemo(() => {
    if (!selectedCommit) return null;
    return new Map(
      (selectedCommit.fileChanges || []).map((fc: any) => [fc.path, fc.changeType || fc.type])
    );
  }, [selectedCommit]);

  const { 
    filters, toggleDirectory, toggleFileType, toggleDomain, resetFilters 
  } = useGraphFilters();

  const {
    expandedNodes, toggleExpand, collapseAll, focusNode, setFocus, clearFocus, goBack, canGoBack
  } = useGraphDrilldown();
  
  const completeGraph = useMemo(() => {
    const analyzer = new GraphAnalyzer();
    return analyzer.buildDependencyGraph(repository?.files || []);
  }, [repository?.files]);

  const graphData = useMemo(() => {
    const filterService = new GraphFilteringService();
    return filterService.applyFilters(completeGraph.nodes, completeGraph.links, {
      expandedNodes,
      hiddenDirectories: filters.hiddenDirectories,
      hiddenFileTypes: filters.hiddenFileTypes,
      visibleDomains: filters.visibleDomains
    });
  }, [completeGraph, expandedNodes, filters]);

  // Compute connections (degree) for each node based on the drilldown-filtered graphData
  const connectionsMap = useMemo(() => {
    const map: Record<string, number> = {};
    graphData.links.forEach((link: any) => {
      const sourceId = typeof link.source === "string" ? link.source : (link.source as any).id;
      const targetId = typeof link.target === "string" ? link.target : (link.target as any).id;
      map[sourceId] = (map[sourceId] || 0) + 1;
      map[targetId] = (map[targetId] || 0) + 1;
    });
    return map;
  }, [graphData.links]);

  // Add degree to nodes
  const nodesWithDegree = useMemo(() => {
    return graphData.nodes.map((node) => ({
      ...node,
      degree: connectionsMap[node.id] || 0,
    }));
  }, [graphData.nodes, connectionsMap]);

  // Extract unique file extensions for filters from the current node set
  const uniqueExtensions = useMemo(() => {
    return Array.from(
      new Set(
        nodesWithDegree
          .filter((n) => n.type === "file")
          .map((n) => {
            const parts = n.name.split(".");
            return parts.length > 1 ? "." + parts.pop() : "other";
          })
      )
    );
  }, [nodesWithDegree]);

  // Filter nodes dynamically
  const filteredNodes = useMemo(() => {
    return nodesWithDegree.filter((node) => {
      // Filter by type
      if (node.type === "folder" && !showFolders) return false;
      if (node.type === "file" && !showFiles) return false;

      // Filter by min connections
      if (node.degree < minConnections) return false;

      // Filter by file extension
      if (node.type === "file" && selectedExtension !== "all") {
        const ext = node.name.includes(".") ? "." + node.name.split(".").pop() : "other";
        if (ext !== selectedExtension) return false;
      }

      return true;
    });
  }, [nodesWithDegree, showFolders, showFiles, minConnections, selectedExtension]);

  const filteredLinks = useMemo(() => {
    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
    return graphData.links.filter((link) => {
      const sourceId = typeof link.source === "string" ? link.source : (link.source as any).id;
      const targetId = typeof link.target === "string" ? link.target : (link.target as any).id;
      return filteredNodeIds.has(sourceId) && filteredNodeIds.has(targetId);
    });
  }, [graphData.links, filteredNodes]);

  const exportGraph = async (format: "png" | "svg") => {
    if (!exportRef.current) return;

    setIsExporting(true);
    const toastId = toast.loading(`Exporting graph as ${format.toUpperCase()}...`);
    
    try {
      // Create options for higher resolution output, especially for PNG
      const options = {
        backgroundColor: "#0f172a", // Dark background to match the theme
        pixelRatio: 3, // High DPI for crisp text
        cacheBust: true,
        style: {
          margin: "0",
          borderRadius: "0",
          boxShadow: "none"
        }
      };

      // We wait a tiny bit to ensure React state has flushed (e.g. MapControls is hidden if we chose to hide them, though we exclude them by not wrapping them in exportRef)
      await new Promise((resolve) => setTimeout(resolve, 100));

      const dataUrl =
        format === "png"
          ? await htmlToImage.toPng(exportRef.current, options)
          : await htmlToImage.toSvg(exportRef.current, options);

      const link = document.createElement("a");
      const repoName = repository?.name ? `-${repository.name}` : "";
      link.download = `gitverse${repoName}-map.${format}`;
      link.href = dataUrl;
      link.click();
      
      toast.success(`Graph exported successfully!`, { id: toastId });
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export the graph. Please try again.", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (!repository?.id) return;
    annotationService.getAnnotations(repository.id).then(setAnnotations);
    
    const unsubscribe = annotationService.subscribeToAnnotations(repository.id, (event) => {
      if (event.type === 'created' || event.type === 'updated') {
        setAnnotations(prev => {
          const idx = prev.findIndex(a => a.id === event.annotation.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = event.annotation;
            return next;
          }
          return [...prev, event.annotation];
        });
      } else if (event.type === 'deleted') {
        setAnnotations(prev => prev.filter(a => a.id !== event.annotationId));
      }
    });

    return () => unsubscribe();
  }, [repository?.id]);

  useEffect(() => {
    if (!svgRef.current) return;

    // If no data, show empty state
    if (filteredNodes.length === 0) {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();
      svg
        .append("text")
        .attr("x", "50%")
        .attr("y", "50%")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "rgba(255,255,255,0.4)")
        .text("No nodes match the filters");
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const containerWidth = svgRef.current.parentElement?.clientWidth || 800;
    const width = Math.min(containerWidth - 40, 800);
    const height = Math.min(width * 0.75, 600);

    svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", height)
      .attr("preserveAspectRatio", "xMidYMid meet");

    const g = svg.append("g");

    // Type colors
    const typeColors: Record<string, string> = {
      folder: "#8b5cf6",
      file: "#3b82f6",
    };

    // Prepare data
    const nodes = filteredNodes.map((d) => ({ ...d }));
    const links = filteredLinks.map((d) => ({ ...d }));
    nodesRef.current = nodes;
    linksRef.current = links;

    // Store in refs for search/centering
    d3SvgRef.current = svg;
    d3GRef.current = g;
    renderedNodesRef.current = nodes;

    // Create force simulation
    const simulation = d3
      .forceSimulation(nodes as any)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d: any) => d.id)
          .distance(100)
          .strength((d: any) => d.strength * 0.5),
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide().radius((d: any) => d.size / 2 + 10),
      );

    // Draw links
    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("class", "link-element")
      .attr("stroke", (d: any) =>
        d.isCyclic ? "#ef4444" : "rgba(255,255,255,0.2)",
      )
      .attr("stroke-width", (d: any) => d.strength * 2)
      .attr("stroke-dasharray", (d: any) => (d.isCyclic ? "5,5" : "none"))
      .attr("stroke-opacity", 0.6)
      .on("contextmenu", (event: any, d: any) => {
        event.preventDefault();
        setPopover({
          isOpen: true,
          x: event.clientX,
          y: event.clientY,
          targetId: `${d.source.id}->${d.target.id}`,
          targetType: 'edge'
        });
      });

    // Draw nodes
    const node = g
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "node-element")
      .style("cursor", "pointer")
      .attr("tabindex", "0")
      .attr("role", "button")
      .attr("aria-label", (d: any) => `${d.type === 'folder' ? 'Directory' : 'File'}: ${d.name}, Path: ${d.path}`)
      .on("focus", function (_event: any, d: any) {
        const connections = linksRef.current.filter((l: any) => l.source.id === d.id || l.target.id === d.id).length;
        setAnnouncement(`Focused on ${d.type} ${d.name}. ${connections} dependencies.`);
        d3.select(this).select("circle")
          .attr("stroke", "#fbbf24")
          .attr("stroke-width", 3);
      })
      .on("blur", function (_event: any, d: any) {
        d3.select(this).select("circle")
          .attr("stroke", "rgba(255,255,255,0.3)")
          .attr("stroke-width", 2);
      })
      .on("keydown", function (event: any, d: any) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (d.type === 'folder') {
            toggleExpand(d.id);
          }
          setFocus(d.id);
        }
      })
      .call(
        d3
          .drag<any, any>()
          .on("start", (event: any, d: any) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event: any, d: any) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (_event: any, d: any) => {
            if (!d.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      )
      .on("contextmenu", (event: any, d: any) => {
        event.preventDefault();
        setPopover({
          isOpen: true,
          x: event.clientX,
          y: event.clientY,
          targetId: d.id,
          targetType: 'node'
        });
      })
      .on("click", (event: any, d: any) => {
        if (event.defaultPrevented) return; // Dragged
        if (d.type === 'folder') {
          toggleExpand(d.id);
        }
        setFocus(d.id);
        setSelectedNodeId(null);
        setSearchQuery("");
      });

    // Node circles
    node
      .append("circle")
      .attr("r", (d: any) => d.size / 3)
      .attr("fill", (d: any) => typeColors[d.type])
      .attr("stroke", "rgba(255,255,255,0.3)")
      .attr("stroke-width", 2)
      .on("mouseenter", function (event: any, d: any) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", d.size / 2.5)
          .attr("stroke", "rgba(255,255,255,0.8)")
          .attr("stroke-width", 3);

        // Highlight connected nodes
        link
          .transition()
          .duration(200)
          .attr("stroke", (l: any) =>
            l.source.id === d.id || l.target.id === d.id
              ? typeColors[d.type]
              : "rgba(255,255,255,0.1)",
          )
          .attr("stroke-opacity", (l: any) =>
            l.source.id === d.id || l.target.id === d.id ? 1 : 0.2,
          );

        if (tooltipRef.current) {
          const tooltip = d3.select(tooltipRef.current);
          tooltip
            .style("opacity", "1")
            .style("display", "block")
            .style("left", `${event.clientX}px`)
            .style("top", `${event.clientY}px`).html(`
              <div class="space-y-1">
                <div class="font-semibold text-sm">${d.name}</div>
                <div class="text-xs capitalize">${d.type}</div>
                <div class="text-xs">${d.path}</div>
              </div>
            `);
        }
      })
      .on("mousemove", function (event: any) {
        if (tooltipRef.current) {
          d3.select(tooltipRef.current)
            .style("left", `${event.clientX}px`)
            .style("top", `${event.clientY}px`);
        }
      })
     .on("mouseleave", function (_event: any, d: any) {
        // Shrink node back to original size and restore stroke
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", d.size / 3)
          .attr("stroke", "rgba(255,255,255,0.3)")
          .attr("stroke-width", 2);

        // Restore link colours
        link
          .transition()
          .duration(200)
          .attr("stroke", (l: any) =>
            l.isCyclic ? "#ef4444" : "rgba(255,255,255,0.2)",
          )
          .attr("stroke-opacity", 0.6);

        // Hide tooltip completely (opacity AND display)
        if (tooltipRef.current) {
          d3.select(tooltipRef.current)
            .style("opacity", "0")
            .style("display", "none");
        }
      });

    // Node labels
    node
      .append("text")
      .text((d: any) =>
        d.name.length > 15 ? d.name.slice(0, 12) + "..." : d.name,
      )
      .attr("font-size", "10px")
      .attr("dx", 0)
      .attr("dy", (d: any) => d.size / 3 + 15)
      .attr("text-anchor", "middle")
      .attr("fill", "currentColor")
      .attr("pointer-events", "none");

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
      setTick(t => t + 1); // trigger react render for annotations
    });

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setTransform({ x: event.transform.x, y: event.transform.y, k: event.transform.k });
      });

    zoomRef.current = zoom;
    svg.call(zoom as any);

    // Animate nodes on load
    node
      .selectAll("circle")
      .attr("r", 0)
      .transition()
      .duration(500)
      .delay((_d: any, i: number) => i * 30)
      .attr("r", (d: any) => d.size / 3);

    svgSelectionRef.current = { node, link };

    return () => {
      simulation.stop();
    };
  }, [filteredNodes, filteredLinks, setFocus, toggleExpand]);

  // Effect to handle focus mode fading
  useEffect(() => {
    if (!svgSelectionRef.current) return;
    const { node, link } = svgSelectionRef.current;

    if (selectedNodeId) return; // Let selectedNodeId effect handle transitions

    if (!focusNode) {
      // Restore opacity
      node.transition().duration(300).style("opacity", 1);
      link.transition().duration(300).attr("stroke-opacity", 0.6);
      return;
    }

    // Determine nodes related to focusNode
    const relatedNodes = new Set<string>();
    relatedNodes.add(focusNode);
    
    linksRef.current.forEach(l => {
      if (l.source.id === focusNode) relatedNodes.add(l.target.id);
      if (l.target.id === focusNode) relatedNodes.add(l.source.id);
    });

    node.transition().duration(300)
      .style("opacity", (d: any) => relatedNodes.has(d.id) ? 1 : 0.2);
    
    link.transition().duration(300)
      .attr("stroke-opacity", (d: any) => 
        (d.source.id === focusNode || d.target.id === focusNode) ? 1 : 0.1
      );
  }, [focusNode, selectedNodeId]);

  // Effect to handle time-travel highlighting
  useEffect(() => {
    if (!svgSelectionRef.current) return;
    const { node, link } = svgSelectionRef.current;

    // If there is a focusNode or selectedNodeId, it overrides time-travel highlighting to prevent conflicting transitions
    if (focusNode || selectedNodeId) return;

    if (!changedFiles) {
      // Restore normal opacity/colors
      node.transition().duration(300)
        .style("opacity", 1)
        .selectAll("circle")
        .attr("stroke", "rgba(255,255,255,0.3)")
        .attr("stroke-width", 2);
      
      link.transition().duration(300).attr("stroke-opacity", 0.6);
      return;
    }

    // Highlight modified files
    node.transition().duration(300)
      .style("opacity", (d: any) => {
        if (d.type === 'file') {
          return changedFiles.has(d.path) ? 1 : 0.2;
        }
        if (d.type === 'folder') {
          for (const [path] of changedFiles.entries() as Iterable<[string, string]>) {
            if (path.startsWith(d.path + '/')) return 1;
          }
          return 0.2;
        }
        return 0.2;
      })
      .selectAll("circle")
      .attr("stroke", (d: any) => {
         if (d.type === 'file' && changedFiles.has(d.path)) {
           const type = changedFiles.get(d.path);
           if (type === 'ADDED' || type === 'added') return '#22c55e'; // green
           if (type === 'DELETED' || type === 'deleted') return '#ef4444'; // red
           return '#eab308'; // yellow for modified
         }
         return "rgba(255,255,255,0.3)";
      })
      .attr("stroke-width", (d: any) => (d.type === 'file' && changedFiles.has(d.path) ? 3 : 2));
      
    // Dim links
    link.transition().duration(300).attr("stroke-opacity", 0.1);
  }, [changedFiles, focusNode, selectedNodeId]);

  // Effect to handle focusing/zooming on the selected node and pulsing it
  useEffect(() => {
    if (!d3SvgRef.current || !d3GRef.current || !svgRef.current) return;

    const svg = d3SvgRef.current;
    const g = d3GRef.current;

    // Reset styles if no search selection is active
    if (!selectedNodeId) {
      g.selectAll(".node-element").style("opacity", 1);
      g.selectAll(".link-element").style("opacity", 0.6);
      g.selectAll("circle")
        .attr("stroke", "rgba(255,255,255,0.3)")
        .attr("stroke-width", 2);
      return;
    }

    // Find target node coordinates
    const targetNode = renderedNodesRef.current.find((n: any) => n.id === selectedNodeId);
    if (!targetNode) return;

    const containerWidth = svgRef.current.parentElement?.clientWidth || 800;
    const width = Math.min(containerWidth - 40, 800);
    const height = Math.min(width * 0.75, 600);

    const x = (targetNode as any).x;
    const y = (targetNode as any).y;

    if (x !== undefined && y !== undefined && zoomRef.current) {
      const scale = 1.8;
      const transformIdentity = d3.zoomIdentity
        .translate(width / 2 - scale * x, height / 2 - scale * y)
        .scale(scale);

      svg.transition()
        .duration(750)
        .call(zoomRef.current.transform as any, transformIdentity);

      // Dim non-matching nodes and links
      g.selectAll(".node-element").style("opacity", (d: any) => 
        d && d.id === selectedNodeId ? 1 : 0.2
      );
      g.selectAll(".link-element").style("opacity", (d: any) => 
        d && (d.source.id === selectedNodeId || d.target.id === selectedNodeId) ? 0.8 : 0.05
      );

      // Pulse the selected node's circle
      const circle = g.selectAll("circle").filter((d: any) => d && d.id === selectedNodeId);
      circle
        .transition()
        .duration(300)
        .attr("r", (d: any) => (d.size / 3) * 1.6)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 4)
        .transition()
        .duration(300)
        .attr("r", (d: any) => d.size / 3)
        .attr("stroke-width", 2)
        .transition()
        .duration(300)
        .attr("r", (d: any) => (d.size / 3) * 1.3)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 3);
    }
  }, [selectedNodeId]);

  const handleZoomIn = () => {
    if (svgRef.current) {
      d3.select(svgRef.current).transition().call(d3.zoom().scaleBy as any, 1.2);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current) {
      d3.select(svgRef.current).transition().call(d3.zoom().scaleBy as any, 0.8);
    }
  };

  const handleReset = () => {
    if (svgRef.current) {
      d3.select(svgRef.current).transition().call(d3.zoom().transform as any, d3.zoomIdentity);
    }
  };

  const handleSaveAnnotation = async (data: Partial<MapAnnotation>) => {
    if (!repository?.id || !popover) return;
    
    try {
      if (popover.initialData?.id) {
        await annotationService.updateAnnotation(popover.initialData.id, data);
        toast.success("Annotation updated");
      } else {
        await annotationService.createAnnotation({
          ...data,
          repositoryId: repository.id,
          targetId: popover.targetId,
          targetType: popover.targetType
        });
        toast.success("Annotation created");
      }
      setPopover(null);
    } catch (e) {
      toast.error("Failed to save annotation");
    }
  };

  const handleDeleteAnnotation = async () => {
    if (!popover?.initialData?.id) return;
    try {
      await annotationService.deleteAnnotation(popover.initialData.id);
      toast.success("Annotation deleted");
      setPopover(null);
    } catch (e) {
      toast.error("Failed to delete annotation");
    }
  };

  return (
    <div className="relative">
      <Card className="glass p-4 sm:p-6 overflow-hidden">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h3 className="text-base sm:text-lg font-semibold">
              Code Dependency Graph
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Interactive visualization of file dependencies and relationships
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 text-xs">
            <button
              onClick={() => setPanelOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors font-medium"
            >
              <MessageSquarePlus size={14} />
              Annotations ({annotations.length})
            </button>
            <div className="flex gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500 flex-shrink-0" />
                <span>Folders</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
                <span>Files</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative">
          {/* Search and Filters Controls */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-black/25 border border-white/5 backdrop-blur-md">
            {/* Search Panel */}
            <div className="flex flex-col gap-1.5 relative">
              <label className="text-xs font-medium text-muted-foreground">Search Nodes</label>
              <div className="flex gap-2">
                <div className="relative flex-grow">
                  <Input
                    placeholder="Search file or folder..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (selectedNodeId) setSelectedNodeId(null);
                    }}
                    className="w-full bg-black/40 border-white/10 text-xs h-9 text-white placeholder-white/40"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedNodeId(null);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              
              {/* Autocomplete Dropdown */}
              {searchQuery && !selectedNodeId && (
                <div className="absolute top-[100%] left-0 right-0 z-50 mt-1 max-h-40 overflow-y-auto rounded-md border border-white/10 bg-zinc-950/95 p-1 shadow-lg backdrop-blur-md">
                  {filteredNodes
                    .filter((n) => n.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .slice(0, 5)
                    .map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          setSelectedNodeId(n.id);
                          setSearchQuery(n.name);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-white/10 transition-colors flex items-center justify-between text-white"
                      >
                        <span className="truncate">{n.name}</span>
                        <span className="text-[10px] text-muted-foreground capitalize px-1.5 py-0.5 bg-white/5 rounded">
                          {n.type}
                        </span>
                      </button>
                    ))}
                  {filteredNodes.filter((n) => n.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <div className="px-3 py-1.5 text-xs text-muted-foreground">No matches found</div>
                  )}
                </div>
              )}
            </div>

            {/* Type & Extension Filters */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Filters</label>
              <div className="flex flex-wrap items-center gap-4 h-9 px-3 rounded-md bg-black/30 border border-white/5">
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none text-white">
                  <input
                    type="checkbox"
                    checked={showFolders}
                    onChange={(e) => {
                      setShowFolders(e.target.checked);
                      setSelectedNodeId(null);
                    }}
                    className="rounded border-white/10 bg-black/40 text-purple-600 focus:ring-purple-500 w-3.5 h-3.5"
                  />
                  <span>Folders</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none text-white">
                  <input
                    type="checkbox"
                    checked={showFiles}
                    onChange={(e) => {
                      setShowFiles(e.target.checked);
                      setSelectedNodeId(null);
                    }}
                    className="rounded border-white/10 bg-black/40 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span>Files</span>
                </label>

                {uniqueExtensions.length > 0 && showFiles && (
                  <select
                    value={selectedExtension}
                    onChange={(e) => {
                      setSelectedExtension(e.target.value);
                      setSelectedNodeId(null);
                    }}
                    className="ml-auto bg-transparent border-0 text-xs text-muted-foreground focus:ring-0 focus:outline-none cursor-pointer outline-none max-w-28 truncate text-white"
                  >
                    <option value="all" className="bg-zinc-950 text-white">All Exts</option>
                    {uniqueExtensions.map((ext) => (
                      <option key={ext} value={ext} className="bg-zinc-950 text-white">
                        {ext}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Centrality / Connections Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs font-medium text-muted-foreground">
                <span>Min Connections</span>
                <span className="text-white bg-white/10 px-1.5 py-0.5 rounded text-[10px]">{minConnections}+</span>
              </div>
              <div className="flex items-center h-9 px-3 rounded-md bg-black/30 border border-white/5">
                <input
                  type="range"
                  min="0"
                  max={nodesWithDegree.length > 0 ? Math.max(...nodesWithDegree.map((n) => n.degree || 0), 5) : 5}
                  value={minConnections}
                  onChange={(e) => {
                    setMinConnections(Number(e.target.value));
                    setSelectedNodeId(null);
                  }}
                  className="w-full accent-purple-500 bg-zinc-800 h-1 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div
            ref={exportRef}
            className="glass rounded-lg p-4 sm:p-6 relative overflow-visible"
          >
            <h3 className="text-base sm:text-lg font-semibold mb-4 text-white">
              Code Dependencies
            </h3>
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <svg
                ref={svgRef}
                width="100%"
                height="auto"
                className="text-white min-h-96 sm:min-h-96"
                style={{ background: "rgba(0,0,0,0.2)", minHeight: "300px" }}
                viewBox="0 0 900 600"
                preserveAspectRatio="xMidYMid meet"
              />
              <div 
                className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible"
                style={{
                  transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
                  transformOrigin: '0 0'
                }}
              >
                {annotations.map(a => {
                  let x = 0;
                  let y = 0;
                  if (a.targetType === 'node') {
                    const node = nodesRef.current.find(n => n.id === a.targetId);
                    if (node) {
                      x = node.x;
                      y = node.y;
                    }
                  } else if (a.targetType === 'edge') {
                    const parts = a.targetId.split('->');
                    const link = linksRef.current.find(l => l.source.id === parts[0] && l.target.id === parts[1]);
                    if (link) {
                      x = (link.source.x + link.target.x) / 2;
                      y = (link.source.y + link.target.y) / 2;
                    }
                  }
                  if (x === 0 && y === 0) return null; // Wait for nodes to be initialized
                  
                  return (
                    <div key={a.id} className="absolute pointer-events-auto" style={{ left: x, top: y }}>
                      <AnnotationMarker 
                        annotation={a} 
                        x={0} 
                        y={0} 
                        onClick={() => setPopover({
                          isOpen: true,
                          x: 0, // In this case we might want to center the popover or use mouse coordinates
                          y: 0,
                          initialData: a
                        })} 
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="absolute bottom-2 right-3 text-[10px] text-white/70 pointer-events-none">
              GitVerse • {repository?.name || "Repository"}
            </div>
            
            <FilterPanel 
              filters={filters} 
              toggleDirectory={toggleDirectory} 
              toggleFileType={toggleFileType} 
              toggleDomain={toggleDomain} 
              resetFilters={resetFilters} 
            />

            <DrilldownControls 
              canGoBack={canGoBack} 
              onGoBack={goBack} 
              onClearFocus={clearFocus} 
              focusNode={focusNode} 
              onResetGraph={() => {
                collapseAll();
                resetFilters();
                clearFocus();
              }} 
            />

            <MiniMap 
              nodes={nodesRef.current} 
              links={linksRef.current} 
              width={svgRef.current?.parentElement?.clientWidth || 800} 
              height={Math.min((svgRef.current?.parentElement?.clientWidth || 800) * 0.75, 600)} 
              svgRef={svgRef} 
              transform={transform} 
            />

          </div>

          <MapControls 
            onZoomIn={handleZoomIn} 
            onZoomOut={handleZoomOut} 
            onReset={handleReset} 
            onExportPng={() => exportGraph("png")}
            onExportSvg={() => exportGraph("svg")}
            isExporting={isExporting}
          />
        </div>

        <p className="text-xs text-muted-foreground mt-2 px-4 sm:px-0">
          💡 Drag nodes to reposition • Scroll to zoom • Hover for details • Right-click to annotate
        </p>

        {repository?.commits && repository.commits.length > 0 && (
          <TimeTravelTimeline 
            commits={repository.commits} 
            selectedCommitHash={selectedCommitHash}
            onCommitSelect={setSelectedCommitHash} 
          />
        )}

        <div
          ref={tooltipRef}
          className="fixed p-3 rounded-lg pointer-events-none shadow-xl border translate-x-[-120px] translate-y-[-120px] sm:translate-x-[-250px] sm:translate-y-[-250px]"
          style={{
            opacity: 0,
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            color: "white",
            zIndex: 9999,
            backdropFilter: "blur(8px)",
            left: "0px",
            top: "0px",
            whiteSpace: "nowrap",
          }}
        />

        {popover?.isOpen && (
          <AnnotationPopover 
            x={popover.initialData ? transform.x + (nodesRef.current.find(n => n.id === popover.initialData?.targetId)?.x || 0) * transform.k : popover.x}
            y={popover.initialData ? transform.y + (nodesRef.current.find(n => n.id === popover.initialData?.targetId)?.y || 0) * transform.k : popover.y}
            initialData={popover.initialData}
            onSave={handleSaveAnnotation}
            onCancel={() => setPopover(null)}
            onDelete={popover.initialData?.id ? handleDeleteAnnotation : undefined}
          />
        )}

        <AnnotationPanel 
          isOpen={panelOpen} 
          onClose={() => setPanelOpen(false)} 
          annotations={annotations} 
          onSelect={(a) => {
            let x = 0, y = 0;
            if (a.targetType === 'node') {
              const node = nodesRef.current.find(n => n.id === a.targetId);
              if (node) { x = node.x; y = node.y; }
            }
            // Animate D3 zoom to annotation
            if (svgRef.current && (x !== 0 || y !== 0)) {
              const width = svgRef.current.clientWidth;
              const height = svgRef.current.clientHeight;
              d3.select(svgRef.current)
                .transition()
                .duration(750)
                .call(d3.zoom().transform as any, d3.zoomIdentity.translate(width/2, height/2).scale(1.5).translate(-x, -y));
            }
          }} 
        />
        
        {/* Screen reader announcement region */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </div>
      </Card>
    </div>
  );
}
