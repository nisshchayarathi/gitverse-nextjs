import { useEffect, useRef, useState, useMemo } from "react";
import * as htmlToImage from "html-to-image";
import * as d3 from "d3";
import { Card } from "@/components/ui";
import { GraphAnalyzer, GraphNode, GraphLink } from "@/utils/graphAnalyzer";
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



interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

/**
 * Standalone helper — mirrors the filtering logic of GraphFilteringService.applyFilters.
 * Extracted here so nodeChurnMap can call it without referencing graphData before
 * it is declared, avoiding a TypeScript temporal dead zone error.
 */
function getFilteredNodes(
  nodes: GraphNode[],
  expandedNodes: Set<string>,
  hiddenDirectories: string[],
  hiddenFileTypes: string[],
  visibleDomains: string[],
): GraphNode[] {
  const service = new GraphFilteringService();
  const result = service.applyFilters(nodes, [], {
    expandedNodes,
    hiddenDirectories,
    hiddenFileTypes,
    visibleDomains,
  });
  return result.nodes;
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
  // Keep a ref always in sync with the latest annotations so the D3 tick
  // callback can read them without causing React re-renders.
  const annotationsRef = useRef<MapAnnotation[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [popover, setPopover] = useState<{ isOpen: boolean, x: number, y: number, initialData?: Partial<MapAnnotation>, targetId?: string, targetType?: 'node'|'edge' } | null>(null);
  const nodesRef = useRef<any[]>([]);
  const linksRef = useRef<any[]>([]);
  
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [heatmapMode, setHeatmapMode] = useState(false);

  // Declare graph data first so nodeChurnMap can reference them without TDZ.
  const completeGraph = useMemo(() => {
    const analyzer = new GraphAnalyzer();
    return analyzer.buildDependencyGraph(repository?.files || []);
  }, [repository?.files]);

  const {
    filters, toggleDirectory, toggleFileType, toggleDomain, resetFilters
  } = useGraphFilters();

  const {
    expandedNodes, toggleExpand, collapseAll, focusNode, setFocus, clearFocus, goBack, canGoBack
  } = useGraphDrilldown();

  const { nodeChurnMap, maxChurn } = useMemo(() => {
    const map = new Map<string, number>();
    if (!repository?.commits) return { nodeChurnMap: map, maxChurn: 0 };

    repository.commits.forEach((c: any) => {
      if (c.fileChanges) {
        c.fileChanges.forEach((fc: any) => {
          const path = fc.path || fc.file;
          if (path) {
            map.set(path, (map.get(path) || 0) + 1);
          }
        });
      }
    });

    // Use the standalone helper so TypeScript can resolve the reference
    // without hitting a temporal dead zone on graphData.
    const filteredNodes = getFilteredNodes(
      completeGraph.nodes,
      expandedNodes,
      filters.hiddenDirectories,
      filters.hiddenFileTypes,
      filters.visibleDomains,
    );

    filteredNodes.forEach(node => {
      if (node.type === 'folder') {
        let count = 0;
        for (const [filePath, fileCount] of map.entries()) {
          if (filePath.startsWith(node.path + '/')) {
            count += fileCount;
          }
        }
        map.set(node.id, count);
      } else {
        map.set(node.id, map.get(node.path) || 0);
      }
    });

    let max = 0;
    for (const val of map.values()) {
      if (val > max) max = val;
    }

    return { nodeChurnMap: map, maxChurn: max };
  }, [
    repository?.commits,
    completeGraph.nodes,
    expandedNodes,
    filters.hiddenDirectories,
    filters.hiddenFileTypes,
    filters.visibleDomains,
  ]);
  }, [repository?.commits]);

  // Keep annotationsRef in sync with the annotations state so the D3 tick
  // callback always has access to the latest list without a closure over stale state.
  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

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

  const graphData = useMemo(() => {
    const filterService = new GraphFilteringService();
    return filterService.applyFilters(completeGraph.nodes, completeGraph.links, {
      expandedNodes,
      hiddenDirectories: filters.hiddenDirectories,
      hiddenFileTypes: filters.hiddenFileTypes,
      visibleDomains: filters.visibleDomains
    });
  }, [completeGraph, expandedNodes, filters]);

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
    .catch(err => console.error(err))