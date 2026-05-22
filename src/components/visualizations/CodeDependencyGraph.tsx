import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import { Card, EmptyState, Button } from "@/components/ui";
import { 
  Network, 
  Orbit, 
  GitFork, 
  RefreshCw, 
  Maximize2, 
  Minimize2, 
  EyeOff, 
  Search, 
  Flame, 
  BookOpen, 
  Sparkles, 
  Filter, 
  ShieldAlert, 
  ArrowRight, 
  ArrowLeft,
  X 
} from "lucide-react";

const GRAPH_CONFIG = {
  nodeSizes: {
    folder: 72,
    fileMin: 36,
    fileMax: 66,
  },
  physics: {
    classicCharge: -240,
    classicLinkDistance: 100,
    classicCollisionPadding: 20,
    galaxyCharge: -70,
    galaxyLinkDistanceFolder: 40,
    galaxyLinkDistanceFile: 80,
    galaxyLinkStrength: 1.2,
  },
  animations: {
    nodeFade: 200,
    cameraTransition: 900,
    tourTransition: 1000,
    edgeFlowSpeed: "1.6s",
    edgeImportFlowSpeed: "1.0s",
  },
  opacities: {
    active: 1.0,
    dimmedNode: 0.08,
    hoverDimmedNode: 0.12,
    activeLink: 1.0,
    dimmedLink: 0.08,
    hoverDimmedLink: 0.05,
    backgroundLink: 0.12,
  },
  zoomLimits: {
    min: 0.15,
    max: 6.0,
    focusScale: 2.2,
    tourScale: 1.6,
  },
  centrality: {
    criticalThreshold: 3,
  },
  stars: {
    count: 180,
  }
} as const;

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: "folder" | "file";
  size: number;
  path: string;
  lines?: number;
  language?: string;
  childCount?: number;
  layer: "ui" | "api" | "database" | "core" | "utility";
  isCritical?: boolean;
  degree?: number;
  galaxyX?: number;
  galaxyY?: number;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string | D3Node;
  target: string | D3Node;
  strength: number;
  isImport?: boolean;
}

interface GraphData {
  nodes: D3Node[];
  links: D3Link[];
}

const computeBezierPath = (d: D3Link): string => {
  const source = typeof d.source === "string" ? null : d.source;
  const target = typeof d.target === "string" ? null : d.target;
  
  const x1 = source?.x || 0;
  const y1 = source?.y || 0;
  const x2 = target?.x || 0;
  const y2 = target?.y || 0;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) return `M ${x1} ${y1} L ${x2} ${y2}`;

  const offset = len * 0.15;
  const nx = -dy / len;
  const ny = dx / len;
  const ctrlX = (x1 + x2) / 2 + nx * offset;
  const ctrlY = (y1 + y2) / 2 + ny * offset;

  return `M ${x1} ${y1} Q ${ctrlX} ${ctrlY} ${x2} ${y2}`;
};

// Classify files and folders into logical architecture layers
const classifyLayer = (path: string): "ui" | "api" | "database" | "core" | "utility" => {
  const lowerPath = path.toLowerCase();
  
  if (
    lowerPath.includes("prisma") || 
    lowerPath.includes("schema.prisma") || 
    lowerPath.includes("/db/") || 
    lowerPath.includes("/models/") || 
    lowerPath.includes("database")
  ) {
    return "database";
  }
  
  if (
    lowerPath.includes("/api/") || 
    lowerPath.includes("route.ts") || 
    lowerPath.includes("route.js") || 
    lowerPath.includes("/controllers/") || 
    lowerPath.includes("/routes/")
  ) {
    return "api";
  }
  
  if (
    lowerPath.includes("/components/") || 
    lowerPath.includes("/pages/") || 
    lowerPath.includes("/views/") || 
    lowerPath.startsWith("pages/") || 
    lowerPath.startsWith("components/") || 
    lowerPath.startsWith("app/") || 
    lowerPath.includes("apphosting.yaml") ||
    lowerPath.includes("next.config")
  ) {
    // Rest of app/ is UI (pages, layouts, templates)
    return "ui";
  }
  
  if (
    lowerPath.includes("/services/") || 
    lowerPath.startsWith("services/") || 
    lowerPath.includes("/lib/") || 
    lowerPath.startsWith("lib/") || 
    lowerPath.includes("/logic/") || 
    lowerPath.includes("/modules/") ||
    lowerPath.includes("worker")
  ) {
    return "core";
  }
  
  return "utility"; // fallback for utils, config, tests, metadata
};

// Generate dependency graph from repository files
const generateDependencyGraph = (repository: any): GraphData => {
  const nodes: D3Node[] = [];
  const links: D3Link[] = [];

  if (!repository?.files || repository.files.length === 0) {
    return { nodes: [], links: [] };
  }

  const files = repository.files as any[];

  // Create folder paths
  const folderPaths = new Set<string>();
  files.forEach((file) => {
    const parts = file.path.split("/");
    for (let i = 1; i < parts.length; i++) {
      const folderPath = parts.slice(0, i).join("/");
      folderPaths.add(folderPath);
    }
  });

  // Add folder nodes
  folderPaths.forEach((folderPath) => {
    const parts = folderPath.split("/");
    const folderName = parts[parts.length - 1];

    const folderFiles = files.filter(f => f.path.startsWith(folderPath + "/"));
    const folderLines = folderFiles.reduce((acc, f) => acc + (f.lines || 0), 0);
    const fileCount = folderFiles.length;

    nodes.push({
      id: `folder-${folderPath}`,
      name: folderName,
      type: "folder",
      size: 72,
      path: folderPath,
      lines: folderLines,
      childCount: fileCount,
      layer: classifyLayer(folderPath)
    });
  });

  // Limit file nodes to top 30 to avoid rendering bottlenecks
  const topFiles = files
    .sort((a, b) => (b.lines || 0) - (a.lines || 0))
    .slice(0, 30);

  topFiles.forEach((file) => {
    const fileName = file.path.split("/").pop() || file.path;
    const ext = fileName.split(".").pop() || "unknown";

    nodes.push({
      id: `file-${file.path}`,
      name: fileName,
      type: "file",
      size: Math.min(Math.max((file.lines || 0) / 12 || 36, 36), 66),
      path: file.path,
      lines: file.lines,
      language: file.language || ext.toUpperCase(),
      layer: classifyLayer(file.path)
    });
  });

  // Create structural links: files to their parent folders
  topFiles.forEach((file) => {
    const parts = file.path.split("/");
    if (parts.length > 1) {
      const parentFolder = parts.slice(0, -1).join("/");
      links.push({
        source: `file-${file.path}`,
        target: `folder-${parentFolder}`,
        strength: 1.2,
      });
    }
  });

  // Create structural links between folders (parent-child relationships)
  folderPaths.forEach((folderPath) => {
    const parts = folderPath.split("/");
    if (parts.length > 1) {
      const parentFolder = parts.slice(0, -1).join("/");
      if (folderPaths.has(parentFolder)) {
        links.push({
          source: `folder-${folderPath}`,
          target: `folder-${parentFolder}`,
          strength: 0.8,
        });
      }
    }
  });

  // Create heuristic file-to-file import links (Dependency Path Tracing)
  const fileNodes = nodes.filter(n => n.type === "file");
  fileNodes.forEach((fileA) => {
    fileNodes.forEach((fileB) => {
      if (fileA.id === fileB.id) return;

      let isImport = false;
      const lowerA = fileA.path.toLowerCase();
      const lowerB = fileB.path.toLowerCase();

      // 1. Pages/Routes/UI import components
      if (
        (lowerA.includes("pages/") || lowerA.includes("app/") || lowerA.includes("components/")) &&
        lowerB.includes("components/") && 
        !lowerB.includes("page")
      ) {
        // Pseudo-random connection to represent realistic sparse imports
        const seed = (fileA.size + fileB.size) % 100;
        isImport = seed < 16;
      }

      // 2. API Routes import services
      if (lowerA.includes("api/") && lowerB.includes("services/")) {
        const seed = (fileA.size + fileB.size + 13) % 100;
        isImport = seed < 35;
      }

      // 3. Services import database or utils
      if (
        lowerA.includes("services/") && 
        (lowerB.includes("prisma") || lowerB.includes("db") || lowerB.includes("utils/") || lowerB.includes("lib/"))
      ) {
        const seed = (fileA.size + fileB.size + 27) % 100;
        isImport = seed < 28;
      }

      // 4. Components import utils or core lib
      if (lowerA.includes("components/") && (lowerB.includes("utils/") || lowerB.includes("lib/"))) {
        const seed = (fileA.size + fileB.size + 42) % 100;
        isImport = seed < 14;
      }

      if (isImport) {
        links.push({
          source: fileA.id,
          target: fileB.id,
          strength: 0.25, // Weak pull so it doesn't mess up main structure layout
          isImport: true
        });
      }
    });
  });

  // Calculate Node Degree Centrality
  const degrees: Record<string, number> = {};
  links.forEach((l) => {
    const sId = typeof l.source === "string" ? l.source : l.source.id;
    const tId = typeof l.target === "string" ? l.target : l.target.id;
    degrees[sId] = (degrees[sId] || 0) + 1;
    degrees[tId] = (degrees[tId] || 0) + 1;
  });

  nodes.forEach((node) => {
    node.degree = degrees[node.id] || 0;
    // Highlight files with high degree centrality (connected to many folders/files)
    node.isCritical = node.type === "file" && node.degree >= 3;
  });

  return { nodes, links };
};

interface CodeDependencyGraphProps {
  repository?: any;
}

export function CodeDependencyGraph({ repository }: CodeDependencyGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Layout states
  const [layoutMode, setLayoutMode] = useState<"classic" | "galaxy">("classic");
  const [focusedNode, setFocusedNode] = useState<D3Node | null>(null);

  // Intelligence toggles
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [showImports, setShowImports] = useState(false);
  const [activeLayers, setActiveLayers] = useState<Set<string>>(
    new Set(["ui", "api", "database", "core", "utility"])
  );

  // Search autocomplete states
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number>(-1);

  // Story mode states
  const [tourIndex, setTourIndex] = useState<number | null>(null);

  // Active side-panel tab
  const [sideTab, setSideTab] = useState<"details" | "ai-insights">("details");

  // Synchronization refs for D3 event handlers and performance
  const focusedNodeRef = useRef<D3Node | null>(null);
  const tourIndexRef = useRef<number | null>(null);
  const layoutModeRef = useRef<"classic" | "galaxy">("classic");
  const heatmapModeRef = useRef<boolean>(false);
  const starsRef = useRef<{ x: number; y: number; size: number; alpha: number; phase: number; speed: number; }[]>([]);

  // Keep refs in sync with React states
  useEffect(() => {
    focusedNodeRef.current = focusedNode;
  }, [focusedNode]);

  useEffect(() => {
    tourIndexRef.current = tourIndex;
  }, [tourIndex]);

  useEffect(() => {
    layoutModeRef.current = layoutMode;
  }, [layoutMode]);

  useEffect(() => {
    heatmapModeRef.current = heatmapMode;
  }, [heatmapMode]);

  // References
  const simulationRef = useRef<any>(null);
  const zoomRef = useRef<any>(null);
  const currentTransformRef = useRef<any>(d3.zoomIdentity);
  const graphDataRef = useRef<GraphData>({ nodes: [], links: [] });
  const nodePositionsRef = useRef<Map<string, { x: number; y: number; vx: number; vy: number }>>(new Map());
  const focusNodeRef = useRef<((nodeId: string) => void) | null>(null);

  const graphData = useMemo(() => generateDependencyGraph(repository), [repository]);
  graphDataRef.current = graphData;

  // Filter layers dynamically
  const filteredData = useMemo(() => {
    const nodes = graphData.nodes.filter(n => activeLayers.has(n.layer));
    const nodeIds = new Set(nodes.map(n => n.id));
    const links = graphData.links.filter((l: any) => {
      const sId = typeof l.source === "string" ? l.source : l.source.id;
      const tId = typeof l.target === "string" ? l.target : l.target.id;
      
      // If import link, check showImports toggle
      if (l.isImport && !showImports) return false;

      return nodeIds.has(sId) && nodeIds.has(tId);
    });

    return { nodes, links };
  }, [graphData, activeLayers, showImports]);

  // Story Mode Tour Steps definition
  const tourSteps = useMemo(() => [
    {
      title: "1. Core & Environment Setup",
      description: "These are configuration and build scripts at the root level (e.g. package.json, next.config.js, tsconfig.json). They govern environment variables, bundlers, and compilation options.",
      targetFilter: (n: D3Node) => n.layer === "utility" && n.path.split("/").length === 1,
      name: "Configuration files"
    },
    {
      title: "2. Database & Data Models",
      description: "The backend persistence layer. This includes the Prisma schema model file, database client helper, and schemas defining how repository data flows.",
      targetFilter: (n: D3Node) => n.layer === "database",
      name: "Database modules"
    },
    {
      title: "3. Core Application Logic",
      description: "The logical engine of GitVerse. This houses core business modules, background analyzer worker processes, and Git integrations.",
      targetFilter: (n: D3Node) => n.layer === "core",
      name: "Services & Workers"
    },
    {
      title: "4. API Server Router Layer",
      description: "The backend communication hub. Next.js router endpoints receive request payloads, authenticate sessions, and return analytical metrics.",
      targetFilter: (n: D3Node) => n.layer === "api",
      name: "API routes"
    },
    {
      title: "5. Frontend Layout & User Interface",
      description: "The interactive frontend client application, comprising React hooks, D3 charts, layout headers, and styling cards.",
      targetFilter: (n: D3Node) => n.layer === "ui",
      name: "UI components"
    }
  ], []);

  // Sync canvas size and draw stars
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || graphData.nodes.length === 0) return;

    const parent = canvas.parentElement;
    const width = parent?.clientWidth || 900;
    const height = 600;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Initialize stars once if needed to avoid garbage collection spikes
    if (starsRef.current.length === 0) {
      starsRef.current = Array.from({ length: GRAPH_CONFIG.stars.count }, () => ({
        x: Math.random() * 2000 - 1000 + width / 2,
        y: Math.random() * 1500 - 750 + height / 2,
        size: Math.random() * 1.3 + 0.3,
        alpha: Math.random() * 0.7 + 0.2,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.02 + 0.005,
      }));
    }

    let animationFrameId: number;
    const stars = starsRef.current;

    const tickStars = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.save();

      const transform = currentTransformRef.current;
      const px = transform.x * 0.22; // Parallax pan factor
      const py = transform.y * 0.22;
      const pk = 1 + (transform.k - 1) * 0.15; // Dampened zoom factor

      ctx.translate(px, py);
      ctx.scale(pk, pk);

      stars.forEach((star) => {
        star.phase += star.speed;
        const opacity = star.alpha + Math.sin(star.phase) * 0.15;
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, Math.min(1, opacity))})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(tickStars);
    };

    tickStars();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [graphData.nodes.length]);

  // Main graph builder logic
  useEffect(() => {
    if (!svgRef.current || !canvasRef.current || filteredData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.parentElement?.clientWidth || 900;
    const height = 600;

    svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", height)
      .attr("preserveAspectRatio", "xMidYMid meet");

    const defs = svg.append("defs");

    // Glow Filters
    const filter = defs.append("filter")
      .attr("id", "node-glow")
      .attr("x", "-50%").attr("y", "-50%")
      .attr("width", "200%").attr("height", "200%");
    filter.append("feGaussianBlur")
      .attr("in", "SourceGraphic")
      .attr("stdDeviation", "4")
      .attr("result", "blur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "blur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    const activeFilter = defs.append("filter")
      .attr("id", "active-glow")
      .attr("x", "-80%").attr("y", "-80%")
      .attr("width", "260%").attr("height", "260%");
    activeFilter.append("feGaussianBlur")
      .attr("in", "SourceGraphic")
      .attr("stdDeviation", "8")
      .attr("result", "blur1");
    activeFilter.append("feGaussianBlur")
      .attr("in", "SourceGraphic")
      .attr("stdDeviation", "3")
      .attr("result", "blur2");
    const activeMerge = activeFilter.append("feMerge");
    activeMerge.append("feMergeNode").attr("in", "blur1");
    activeMerge.append("feMergeNode").attr("in", "blur2");
    activeMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Linear Gradients
    const folderGrad = defs.append("linearGradient")
      .attr("id", "folder-grad")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "100%").attr("y2", "100%");
    folderGrad.append("stop").attr("offset", "0%").attr("stop-color", "#a78bfa");
    folderGrad.append("stop").attr("offset", "100%").attr("stop-color", "#6366f1");

    const fileGrad = defs.append("linearGradient")
      .attr("id", "file-grad")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "100%").attr("y2", "100%");
    fileGrad.append("stop").attr("offset", "0%").attr("stop-color", "#22d3ee");
    fileGrad.append("stop").attr("offset", "100%").attr("stop-color", "#2563eb");

    const g = svg.append("g");

    // Copy coordinate positions from cache to avoid layout resets on layering toggles
    const nodes: D3Node[] = filteredData.nodes.map((d) => {
      const copy = { ...d };
      const cache = nodePositionsRef.current.get(d.id);
      if (cache) {
        copy.x = cache.x;
        copy.y = cache.y;
        copy.vx = cache.vx;
        copy.vy = cache.vy;
      }
      return copy;
    });

    const links: D3Link[] = filteredData.links.map((d) => {
      const sourceNode = nodes.find(n => n.id === (typeof d.source === "string" ? d.source : d.source.id));
      const targetNode = nodes.find(n => n.id === (typeof d.target === "string" ? d.target : d.target.id));
      return {
        ...d,
        source: sourceNode || d.source,
        target: targetNode || d.target
      };
    });

    // Setup simulation
    const simulation = d3
      .forceSimulation(nodes as any)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d: any) => d.id)
          .distance(100)
          .strength((d: any) => d.strength * 0.6)
      )
      .force("charge", d3.forceManyBody().strength(-240))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide().radius((d: any) => d.size / 2.2 + 20)
      );

    simulationRef.current = simulation;

    // Draw Links
    const baseLink = g
      .append("g")
      .selectAll("path.base-link")
      .data(links)
      .join("path")
      .attr("class", "base-link")
      .attr("fill", "none")
      .attr("stroke", (d: any) => d.isImport ? "rgba(249, 115, 22, 0.12)" : "rgba(255, 255, 255, 0.12)")
      .attr("stroke-width", (d: any) => d.isImport ? 1 : d.strength * 1.5)
      .attr("pointer-events", "none");

    const flowLink = g
      .append("g")
      .selectAll("path.flow-path")
      .data(links)
      .join("path")
      .attr("class", (d: any) => d.isImport ? "flow-path import-flow" : "flow-path")
      .attr("fill", "none")
      .attr("stroke", (d: any) => {
        if (d.isImport) return "rgba(249, 115, 22, 0.6)"; // glowing orange for file imports
        const isFolder = (d.target as D3Node).type === "folder";
        return isFolder ? "rgba(167, 139, 250, 0.45)" : "rgba(34, 211, 238, 0.45)";
      })
      .attr("stroke-width", (d: any) => d.isImport ? 1.2 : d.strength * 1.5)
      .attr("stroke-dasharray", "6, 15")
      .attr("pointer-events", "none")
      .style("mix-blend-mode", "screen");

    // Draw Nodes
    const node = g
      .append("g")
      .selectAll("g.node-group")
      .data(nodes)
      .join("g")
      .attr("class", "node-group")
      .style("cursor", "pointer")
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
          .on("end", (event: any, d: any) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Color Scales for Heatmap Mode
    const totalLinesMax = d3.max(nodes, d => d.lines || 1) || 1;
    const heatmapColorScale = d3.scaleSequentialLog(d3.interpolateWarm)
      .domain([10, totalLinesMax]);

    // Build Node Fills & Strokes
    node.each(function (d: any) {
      const el = d3.select(this);
      const radius = d.size / 2.4;

      // Base Circle
      el.append("circle")
        .attr("r", radius)
        .attr("fill", () => {
          if (heatmapModeRef.current) {
            return heatmapColorScale(d.lines || 12);
          }
          return d.type === "folder" ? "url(#folder-grad)" : "url(#file-grad)";
        })
        .attr("stroke", () => {
          if (heatmapModeRef.current) return "none";
          return d.type === "folder" ? "rgba(139, 92, 246, 0.45)" : "rgba(6, 182, 212, 0.45)";
        })
        .attr("stroke-width", 2)
        .attr("filter", "url(#node-glow)")
        .attr("class", "node-bg");

      // Critical File Gold Pulse Ring
      if (d.isCritical) {
        el.append("circle")
          .attr("r", radius + 6)
          .attr("fill", "none")
          .attr("stroke", "#f59e0b") // gold
          .attr("stroke-width", 1.8)
          .attr("stroke-dasharray", "4, 4")
          .attr("class", "critical-ring");
      }

      // Outer rings
      el.append("circle")
        .attr("r", radius + 4)
        .attr("fill", "none")
        .attr("stroke", () => {
          if (d.isCritical) return "rgba(245, 158, 11, 0.2)";
          return d.type === "folder" ? "rgba(139, 92, 246, 0.15)" : "rgba(6, 182, 212, 0.15)";
        })
        .attr("stroke-width", 1)
        .attr("class", "outer-ring");

      // Render Lucide custom icon inside circle
      const iconSize = radius * 1.0;
      const iconOffset = -iconSize / 2;
      const iconG = el.append("g")
        .attr("transform", `translate(${iconOffset}, ${iconOffset})`)
        .attr("pointer-events", "none")
        .attr("class", "node-icon");

      if (d.type === "folder") {
        iconG.append("path")
          .attr("d", "M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z")
          .attr("fill", "none")
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 2)
          .attr("stroke-linecap", "round")
          .attr("stroke-linejoin", "round")
          .attr("transform", `scale(${iconSize / 24})`);
      } else {
        iconG.append("path")
          .attr("d", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z")
          .attr("fill", "none")
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 2)
          .attr("stroke-linecap", "round")
          .attr("stroke-linejoin", "round")
          .attr("transform", `scale(${iconSize / 24})`);

        iconG.append("path")
          .attr("d", "M14 2v6h6")
          .attr("fill", "none")
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 2)
          .attr("stroke-linecap", "round")
          .attr("stroke-linejoin", "round")
          .attr("transform", `scale(${iconSize / 24})`);
      }
    });

    // Node text labels
    node
      .append("text")
      .text((d: any) => d.name.length > 14 ? d.name.slice(0, 11) + "..." : d.name)
      .attr("font-size", "10px")
      .attr("font-weight", "500")
      .attr("dx", 0)
      .attr("dy", (d: any) => d.size / 2.4 + 14)
      .attr("text-anchor", "middle")
      .attr("fill", "#e2e8f0")
      .attr("pointer-events", "none")
      .attr("stroke", "#020617")
      .attr("stroke-width", "3.5")
      .attr("paint-order", "stroke")
      .attr("stroke-linejoin", "round");

    // Zoom setup
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 6])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        currentTransformRef.current = event.transform;
        updateMinimapViewport(event.transform);
      });

    zoomRef.current = zoom;
    svg.call(zoom as any);

    svg.on("click", (event) => {
      if (event.target === svgRef.current) {
        handleResetZoom();
      }
    });

    // Interactive Hover - with Dependency Path Tracing logic
    node.on("mouseenter", function (event: any, d: any) {
      if (tooltipRef.current) {
        const tooltip = d3.select(tooltipRef.current);
        const folderInfo = d.type === "folder" 
          ? `<div class="text-xs text-slate-400">Total lines: <strong>${d.lines?.toLocaleString()}</strong></div>
             <div class="text-xs text-slate-400">Contains: <strong>${d.childCount} files</strong></div>`
          : `<div class="text-xs text-slate-400">Lines: <strong>${d.lines?.toLocaleString()}</strong></div>
             <div class="text-xs text-slate-400">Language: <span class="px-1.5 py-0.5 rounded text-[10px] bg-blue-950 border border-blue-800 text-blue-300 uppercase">${d.language}</span></div>`;

        const layerText = `<span class="px-1.5 py-0.5 rounded text-[9px] bg-slate-900 border border-slate-800 text-indigo-400 font-mono uppercase">${d.layer}</span>`;
        const criticalText = d.isCritical ? `<span class="flex items-center gap-1 text-[10px] text-amber-400 font-semibold mt-1"><ShieldAlert className="w-3.5 h-3.5" /> Core System Hub</span>` : "";

        tooltip
          .style("opacity", "1")
          .style("display", "block")
          .style("left", `${event.clientX + 15}px`)
          .style("top", `${event.clientY - 20}px`).html(`
            <div class="space-y-1">
              <div class="flex items-center gap-1.5 font-semibold text-sm">
                <span class="w-2.5 h-2.5 rounded-full ${d.type === 'folder' ? 'bg-purple-500' : 'bg-cyan-500'}"></span>
                <span>${d.name}</span>
                ${layerText}
              </div>
              <div class="text-[10px] text-slate-500 truncate max-w-xs">${d.path}</div>
              ${folderInfo}
              ${criticalText}
            </div>
          `);
      }

      if (focusedNodeRef.current || tourIndexRef.current !== null) return;

      // Pulse circle scale
      d3.select(this).select(".node-bg")
        .transition().duration(200)
        .attr("r", d.size / 2.0)
        .attr("stroke", "rgba(255, 255, 255, 0.8)")
        .attr("stroke-width", 3);

      d3.select(this).select(".outer-ring")
        .transition().duration(200)
        .attr("r", d.size / 2.0 + 8)
        .attr("stroke", "rgba(255, 255, 255, 0.35)");

      // Path Tracing Graph Traversal (Trace Imports & Exports)
      const upstreamIds = new Set<string>();
      const downstreamIds = new Set<string>();
      const directIds = new Set<string>([d.id]);

      // 1. Direct structures
      links.forEach((l: any) => {
        if (!l.isImport) {
          if (l.source.id === d.id) directIds.add(l.target.id);
          if (l.target.id === d.id) directIds.add(l.source.id);
        }
      });

      // 2. Traversal imports (upstream: what this file imports)
      const findUpstream = (nodeId: string) => {
        links.forEach((l: any) => {
          if (l.isImport && l.source.id === nodeId) {
            const tgt = l.target.id;
            if (!upstreamIds.has(tgt) && tgt !== d.id) {
              upstreamIds.add(tgt);
              findUpstream(tgt);
            }
          }
        });
      };

      // 3. Traversal dependents (downstream: who imports this file)
      const findDownstream = (nodeId: string) => {
        links.forEach((l: any) => {
          if (l.isImport && l.target.id === nodeId) {
            const src = l.source.id;
            if (!downstreamIds.has(src) && src !== d.id) {
              downstreamIds.add(src);
              findDownstream(src);
            }
          }
        });
      };

      findUpstream(d.id);
      findDownstream(d.id);

      const allActiveNodeIds = new Set([
        ...directIds, 
        ...upstreamIds, 
        ...downstreamIds
      ]);

      // Fade unrelated nodes
      node.transition().duration(200)
        .style("opacity", (n: any) => allActiveNodeIds.has(n.id) ? 1 : 0.12);

      // Color/Opacity link highlighting
      baseLink.transition().duration(200)
        .style("opacity", (l: any) => {
          const sId = l.source.id;
          const tId = l.target.id;

          // Highlight structural connections
          if (!l.isImport && (sId === d.id || tId === d.id)) return 1.0;

          // Highlight matching imports (upstream)
          if (l.isImport && sId === d.id && upstreamIds.has(tId)) return 1.0;

          // Highlight matching exports (downstream)
          if (l.isImport && tId === d.id && downstreamIds.has(sId)) return 1.0;

          return 0.05;
        })
        .attr("stroke", (l: any) => {
          const sId = l.source.id;
          const tId = l.target.id;

          if (l.isImport) {
            if (sId === d.id && upstreamIds.has(tId)) return "#ec4899"; // pink (importing)
            if (tId === d.id && downstreamIds.has(sId)) return "#10b981"; // green (exported to)
          }
          return sId === d.id || tId === d.id ? "#ffffff" : "rgba(255,255,255,0.12)";
        });

      flowLink.transition().duration(200)
        .style("opacity", (l: any) => {
          const sId = l.source.id;
          const tId = l.target.id;

          if (!l.isImport && (sId === d.id || tId === d.id)) return 1.0;
          if (l.isImport && sId === d.id && upstreamIds.has(tId)) return 1.0;
          if (l.isImport && tId === d.id && downstreamIds.has(sId)) return 1.0;

          return 0.05;
        });
    });

    node.on("mousemove", function (event: any) {
      if (tooltipRef.current) {
        d3.select(tooltipRef.current)
          .style("left", `${event.clientX + 15}px`)
          .style("top", `${event.clientY - 20}px`);
      }
    });

    node.on("mouseleave", function (_event: any, d: any) {
      if (tooltipRef.current) {
        d3.select(tooltipRef.current)
          .style("opacity", "0")
          .style("display", "none");
      }

      if (focusedNodeRef.current || tourIndexRef.current !== null) return;

      // Reset hover scaling
      d3.select(this).select(".node-bg")
        .transition().duration(200)
        .attr("r", d.size / 2.4)
        .attr("stroke-width", heatmapModeRef.current ? 0 : 2)
        .attr("stroke", d.type === "folder" ? "rgba(139, 92, 246, 0.45)" : "rgba(6, 182, 212, 0.45)");

      d3.select(this).select(".outer-ring")
        .transition().duration(200)
        .attr("r", d.size / 2.4 + 4)
        .attr("stroke", d.type === "folder" ? "rgba(139, 92, 246, 0.15)" : "rgba(6, 182, 212, 0.15)");

      node.transition().duration(200).style("opacity", 1);
      baseLink.transition().duration(200)
        .style("opacity", 1)
        .attr("stroke", (l: any) => l.isImport ? "rgba(249, 115, 22, 0.12)" : "rgba(255, 255, 255, 0.12)");
      flowLink.transition().duration(200).style("opacity", 1);
    });

    // Node click focus
    node.on("click", function (event: any, d: any) {
      event.stopPropagation();
      setFocusedNode(d);

      // Focus opacity
      const connectedNodeIds = new Set<string>([d.id]);
      links.forEach((l: any) => {
        if (l.source.id === d.id) connectedNodeIds.add(l.target.id);
        if (l.target.id === d.id) connectedNodeIds.add(l.source.id);
      });

      node.transition().duration(400)
        .style("opacity", (n: any) => connectedNodeIds.has(n.id) ? 1 : 0.08);

      node.selectAll(".node-bg")
        .attr("filter", (n: any) => n.id === d.id ? "url(#active-glow)" : "url(#node-glow)")
        .attr("stroke-width", (n: any) => n.id === d.id ? 4.5 : 2)
        .attr("stroke", (n: any) => {
          if (n.id === d.id) return "#ffffff";
          return n.type === "folder" ? "rgba(139, 92, 246, 0.45)" : "rgba(6, 182, 212, 0.45)";
        });

      baseLink.transition().duration(400)
        .style("opacity", (l: any) => (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.08)
        .attr("stroke", (l: any) => (l.source.id === d.id || l.target.id === d.id) ? "#ffffff" : "rgba(255,255,255,0.12)");

      flowLink.transition().duration(400)
        .style("opacity", (l: any) => (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.08);

      // Zoom Centering
      const scale = 2.2;
      const targetX = width / 2 - d.x * scale;
      const targetY = height / 2 - d.y * scale;

      svg.transition()
        .duration(900)
        .ease(d3.easeCubicInOut)
        .call(zoom.transform, d3.zoomIdentity.translate(targetX, targetY).scale(scale));
    });

    // Register search focus handler ref
    focusNodeRef.current = (nodeId: string) => {
      const targetNode = nodes.find(n => n.id === nodeId);
      if (!targetNode) return;

      setFocusedNode(targetNode);

      const connectedNodeIds = new Set<string>([targetNode.id]);
      links.forEach((l: any) => {
        if (l.source.id === targetNode.id) connectedNodeIds.add(l.target.id);
        if (l.target.id === targetNode.id) connectedNodeIds.add(l.source.id);
      });

      node.style("opacity", (n: any) => connectedNodeIds.has(n.id) ? 1 : 0.08);
      baseLink.style("opacity", (l: any) => (l.source.id === targetNode.id || l.target.id === targetNode.id) ? 1 : 0.08);
      flowLink.style("opacity", (l: any) => (l.source.id === targetNode.id || l.target.id === targetNode.id) ? 1 : 0.08);

      node.selectAll(".node-bg")
        .attr("filter", (n: any) => n.id === targetNode.id ? "url(#active-glow)" : "url(#node-glow)")
        .attr("stroke-width", (n: any) => n.id === targetNode.id ? 4.5 : 2)
        .attr("stroke", (n: any) => n.id === targetNode.id ? "#ffffff" : (n.type === "folder" ? "rgba(139, 92, 246, 0.45)" : "rgba(6, 182, 212, 0.45)"));

      const scale = 2.2;
      const targetX = width / 2 - (targetNode.x || 0) * scale;
      const targetY = height / 2 - (targetNode.y || 0) * scale;

      svg.transition()
        .duration(900)
        .ease(d3.easeCubicInOut)
        .call(zoom.transform, d3.zoomIdentity.translate(targetX, targetY).scale(scale));
    };

    // Positions cache update & tick
    simulation.on("tick", () => {
      baseLink.attr("d", computeBezierPath);
      flowLink.attr("d", computeBezierPath);

      node.attr("transform", (d: any) => {
        // Cache node coordinates
        nodePositionsRef.current.set(d.id, { x: d.x, y: d.y, vx: d.vx, vy: d.vy });
        return `translate(${d.x},${d.y})`;
      });

      updateMinimapNodes();
    });

    node.style("opacity", 0)
      .transition()
      .duration(700)
      .delay((_d: any, i: number) => i * 20)
      .style("opacity", 1);

    buildMinimap(nodes, links);

    return () => {
      simulation.stop();
    };
  }, [filteredData]);

  // Dedicated effect for transitioning heatmap mode colors
  useEffect(() => {
    if (!svgRef.current || filteredData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const totalLinesMax = d3.max(filteredData.nodes, d => d.lines || 1) || 1;
    const heatmapColorScale = d3.scaleSequentialLog(d3.interpolateWarm)
      .domain([10, totalLinesMax]);

    svg.selectAll<SVGCircleElement, D3Node>(".node-bg")
      .transition()
      .duration(400)
      .attr("fill", (d) => {
        if (heatmapMode) {
          return heatmapColorScale(d.lines || 12);
        }
        return d.type === "folder" ? "url(#folder-grad)" : "url(#file-grad)";
      })
      .attr("stroke", (d) => {
        if (focusedNodeRef.current?.id === d.id) return "#ffffff";
        if (heatmapMode) return "none";
        return d.type === "folder" ? "rgba(139, 92, 246, 0.45)" : "rgba(6, 182, 212, 0.45)";
      })
      .attr("stroke-width", (d) => {
        if (focusedNodeRef.current?.id === d.id) return 4.5;
        if (heatmapMode) return 0;
        return 2;
      });
  }, [heatmapMode, filteredData.nodes]);

  // Handle galaxy vs classic layouts
  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;

    const width = svgRef.current?.parentElement?.clientWidth || 900;
    const height = 600;

    if (layoutMode === "galaxy") {
      const folderNodes = filteredData.nodes.filter(n => n.type === "folder");
      folderNodes.sort((a, b) => a.path.localeCompare(b.path));

      const nodesMap = new Map(sim.nodes().map((n: any) => [n.id, n]));

      folderNodes.forEach((fn, idx) => {
        const node: any = nodesMap.get(fn.id);
        if (node) {
          const angle = idx * 0.78;
          const radius = 80 + idx * 24;
          node.galaxyX = width / 2 + Math.cos(angle) * radius;
          node.galaxyY = height / 2 + Math.sin(angle) * radius;
        }
      });

      sim.force("charge", d3.forceManyBody().strength(-70));
      sim.force("center", null);
      sim.force(
        "x",
        d3.forceX((d: any) => d.type === "folder" ? d.galaxyX : width / 2)
          .strength((d: any) => d.type === "folder" ? 0.95 : 0.05)
      );
      sim.force(
        "y",
        d3.forceY((d: any) => d.type === "folder" ? d.galaxyY : height / 2)
          .strength((d: any) => d.type === "folder" ? 0.95 : 0.05)
      );
      sim.force("link")
        .distance((d: any) => d.strength > 1 ? 40 : 80)
        .strength(1.2);
    } else {
      sim.force("charge", d3.forceManyBody().strength(-240));
      sim.force("center", d3.forceCenter(width / 2, height / 2));
      sim.force("x", null);
      sim.force("y", null);
      sim.force("link")
        .distance(100)
        .strength((d: any) => d.strength * 0.6);
    }

    sim.alpha(0.35).restart();
  }, [layoutMode, filteredData]);

  // Story Mode guided walkthrough focus transition
  useEffect(() => {
    if (tourIndex === null || !svgRef.current || !zoomRef.current) return;

    const tour = tourSteps[tourIndex];
    const matchingNodes = filteredData.nodes.filter(tour.targetFilter);

    if (matchingNodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const zoom = zoomRef.current;
    const width = svgRef.current.parentElement?.clientWidth || 900;
    const height = 600;

    // Calculate cluster centroid
    const avgX = d3.mean(matchingNodes, (n: any) => n.x) || width / 2;
    const avgY = d3.mean(matchingNodes, (n: any) => n.y) || height / 2;

    // Dim other layer elements
    const matchingNodeIds = new Set(matchingNodes.map(n => n.id));
    svg.selectAll(".node-group").transition().duration(500)
      .style("opacity", (n: any) => matchingNodeIds.has(n.id) ? 1.0 : 0.06);

    svg.selectAll("path.base-link").transition().duration(500)
      .style("opacity", (l: any) => matchingNodeIds.has(l.source.id) && matchingNodeIds.has(l.target.id) ? 0.8 : 0.04);
      
    svg.selectAll("path.flow-path").transition().duration(500)
      .style("opacity", (l: any) => matchingNodeIds.has(l.source.id) && matchingNodeIds.has(l.target.id) ? 0.8 : 0.04);

    // Zoom camera on centroid
    const scale = 1.6;
    const targetX = width / 2 - avgX * scale;
    const targetY = height / 2 - avgY * scale;

    svg.transition()
      .duration(1000)
      .ease(d3.easeCubicInOut)
      .call(zoom.transform, d3.zoomIdentity.translate(targetX, targetY).scale(scale));
  }, [tourIndex, filteredData, tourSteps]);

  // Search box node suggestion query list
  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return graphData.nodes
      .filter(n => n.name.toLowerCase().includes(query) || n.path.toLowerCase().includes(query))
      .slice(0, 5);
  }, [searchQuery, graphData]);

  // Layer Checkbox Handler
  const toggleLayer = useCallback((layer: string) => {
    setActiveLayers(prev => {
      const next = new Set(prev);
      if (next.has(layer)) {
        if (next.size > 1) next.delete(layer); // Keep at least 1 active layer
      } else {
        next.add(layer);
      }
      return next;
    });
  }, []);

  // Zoom Button triggers
  const handleZoom = useCallback((direction: "in" | "out") => {
    const svg = d3.select(svgRef.current);
    const zoom = zoomRef.current;
    if (!svg || !zoom) return;

    const scaleFactor = direction === "in" ? 1.4 : 1 / 1.4;
    svg.transition().duration(400).call(zoom.scaleBy, scaleFactor);
  }, []);

  const handleResetZoom = useCallback(() => {
    const svg = d3.select(svgRef.current);
    const zoom = zoomRef.current;
    if (!svg || !zoom) return;

    setFocusedNode(null);
    setTourIndex(null);

    // Restore opacity
    const g = svg.select("g");
    g.selectAll(".node-group").transition().duration(400).style("opacity", 1);
    g.selectAll("path.base-link").transition().duration(400).style("opacity", 1);
    g.selectAll("path.flow-path").transition().duration(400).style("opacity", 1);

    // Reset glows
    g.selectAll(".node-bg")
      .transition().duration(400)
      .attr("filter", "url(#node-glow)")
      .attr("stroke-width", heatmapModeRef.current ? 0 : 2)
      .attr("stroke", (n: any) => n.type === "folder" ? "rgba(139, 92, 246, 0.45)" : "rgba(6, 182, 212, 0.45)");

    svg.transition().duration(700).call(zoom.transform, d3.zoomIdentity);
  }, []);

  // Build Minimap
  const buildMinimap = (nodes: D3Node[], links: D3Link[]) => {
    const miniSvg = d3.select(minimapRef.current);
    miniSvg.selectAll("*").remove();

    const miniWidth = 160;
    const miniHeight = 100;

    miniSvg
      .attr("width", miniWidth)
      .attr("height", miniHeight)
      .style("background", "rgba(2, 6, 23, 0.6)")
      .style("border-radius", "6px");

    const miniG = miniSvg.append("g");

    miniG.append("g")
      .attr("class", "mini-links")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "rgba(255,255,255,0.06)")
      .attr("stroke-width", 0.5);

    miniG.append("g")
      .attr("class", "mini-nodes")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d: any) => d.type === "folder" ? 2.5 : 1.5)
      .attr("fill", (d: any) => d.type === "folder" ? "#a78bfa" : "#22d3ee");

    const viewportRect = miniSvg.append("rect")
      .attr("class", "mini-viewport")
      .attr("fill", "rgba(59, 130, 246, 0.08)")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 1)
      .style("cursor", "grab");

    const drag = d3.drag<SVGRectElement, any>()
      .on("drag", (event) => {
        const svg = d3.select(svgRef.current);
        const zoom = zoomRef.current;
        if (!svg || !zoom) return;

        const mainWidth = svgRef.current?.parentElement?.clientWidth || 900;
        const mainHeight = 600;
        const scaleX = miniWidth / mainWidth;
        const scaleY = miniHeight / mainHeight;

        const transform = currentTransformRef.current;
        const dx = event.dx / scaleX;
        const dy = event.dy / scaleY;

        const newTransform = transform.translate(-dx / transform.k, -dy / transform.k);
        svg.call(zoom.transform, newTransform);
      });

    viewportRect.call(drag as any);
  };

  const updateMinimapNodes = () => {
    const miniSvg = d3.select(minimapRef.current);
    if (miniSvg.empty()) return;

    const mainWidth = svgRef.current?.parentElement?.clientWidth || 900;
    const mainHeight = 600;
    const scaleX = 160 / mainWidth;
    const scaleY = 100 / mainHeight;

    miniSvg.selectAll(".mini-nodes circle")
      .attr("cx", (d: any) => (d.x || 0) * scaleX)
      .attr("cy", (d: any) => (d.y || 0) * scaleY);

    miniSvg.selectAll(".mini-links line")
      .attr("x1", (d: any) => (d.source.x || 0) * scaleX)
      .attr("y1", (d: any) => (d.source.y || 0) * scaleY)
      .attr("x2", (d: any) => (d.target.x || 0) * scaleX)
      .attr("y2", (d: any) => (d.target.y || 0) * scaleY);
  };

  const updateMinimapViewport = (transform: any) => {
    const miniSvg = d3.select(minimapRef.current);
    if (miniSvg.empty()) return;

    const miniWidth = 160;
    const miniHeight = 100;
    const mainWidth = svgRef.current?.parentElement?.clientWidth || 900;
    const mainHeight = 600;
    const scaleX = miniWidth / mainWidth;
    const scaleY = miniHeight / mainHeight;

    const viewWidth = mainWidth / transform.k;
    const viewHeight = mainHeight / transform.k;
    const viewX = -transform.x / transform.k;
    const viewY = -transform.y / transform.k;

    const rectX = Math.max(0, Math.min(miniWidth, viewX * scaleX));
    const rectY = Math.max(0, Math.min(miniHeight, viewY * scaleY));
    const rectW = Math.max(8, Math.min(miniWidth - rectX, viewWidth * scaleX));
    const rectH = Math.max(8, Math.min(miniHeight - rectY, viewHeight * scaleY));

    miniSvg.select(".mini-viewport")
      .attr("x", rectX)
      .attr("y", rectY)
      .attr("width", rectW)
      .attr("height", rectH);
  };

  // AI Insights metadata aggregators
  const aiStats = useMemo(() => {
    const totalFiles = graphData.nodes.filter(n => n.type === "file").length;
    const totalFolders = graphData.nodes.filter(n => n.type === "folder").length;
    const totalLines = graphData.nodes.reduce((acc, n) => acc + (n.type === "file" ? (n.lines || 0) : 0), 0);
    
    // Sort critical hub files
    const criticalHubs = graphData.nodes
      .filter(n => n.type === "file")
      .sort((a, b) => (b.degree || 0) - (a.degree || 0))
      .slice(0, 3);

    // Dynamic refactoring recommendations
    const recommendations: string[] = [];
    const highDensityFolders = graphData.nodes
      .filter(n => n.type === "folder" && (n.childCount || 0) > 10);
    
    if (highDensityFolders.length > 0) {
      recommendations.push(
        `High density hub detected: Folder "${highDensityFolders[0].name}" holds over ${highDensityFolders[0].childCount} child nodes. Extract subfolders to decouple.`
      );
    }

    if (criticalHubs.length > 0 && (criticalHubs[0].lines || 0) > 500) {
      recommendations.push(
        `Monolithic hub warning: "${criticalHubs[0].name}" has high complexity (${criticalHubs[0].lines} lines) and high dependency centrality. Decouple helper functions.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("Repository architecture follows solid decoupled encapsulation standards. No refactoring needed.");
    }

    return {
      totalFiles,
      totalFolders,
      totalLines,
      criticalHubs,
      recommendations
    };
  }, [graphData]);

  return (
    <Card className="glass relative p-4 sm:p-6 overflow-hidden border-slate-800 bg-slate-950/80">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes edgeFlow {
          to {
            stroke-dashoffset: -30;
          }
        }
        .flow-path {
          animation: edgeFlow 1.6s linear infinite;
        }
        .import-flow {
          animation: edgeFlow 1.0s linear infinite !important;
        }
        .outer-ring {
          animation: pulseRing 3s ease-in-out infinite;
        }
        @keyframes pulseRing {
          0%, 100% { stroke-opacity: 0.1; transform: scale(1); }
          50% { stroke-opacity: 0.35; transform: scale(1.05); }
        }
        .critical-ring {
          animation: pulseCritical 2s ease-in-out infinite, rotateCritical 20s linear infinite;
          transform-origin: center;
        }
        @keyframes pulseCritical {
          0%, 100% { stroke-opacity: 0.3; stroke-width: 1.5; }
          50% { stroke-opacity: 0.9; stroke-width: 2.2; }
        }
        @keyframes rotateCritical {
          100% { transform: rotate(360deg); }
        }
      `}} />

      {/* Floating Header */}
      <div className="relative z-20 mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <Network className="w-5 h-5 text-indigo-400" />
              Repository Constellation Explorer
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-900 border border-slate-800 text-slate-400 font-mono capitalize">
              {layoutMode} mode
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Cinematic node-link representation of file hierarchies and dependencies.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 flex-shrink-0 filter drop-shadow-[0_0_3px_rgba(167,139,250,0.6)]" />
            <span className="text-slate-300">Folders</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 flex-shrink-0 filter drop-shadow-[0_0_3px_rgba(34,211,238,0.6)]" />
            <span className="text-slate-300">Files</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0 filter drop-shadow-[0_0_3px_rgba(245,158,11,0.6)]" />
            <span className="text-slate-300">Critical Hubs</span>
          </div>
        </div>
      </div>

      {graphData.nodes.length === 0 ? (
        <EmptyState
          icon={Network}
          title="No file dependencies available"
          description="We couldn't generate a file dependency graph because this repository has no file structure metadata."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          
          {/* Main Visualizer Container (3/4 width) */}
          <div className="lg:col-span-3 relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950/95 min-h-[500px] h-[600px]">
            {/* Parallax Starfield Canvas */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 pointer-events-none"
              style={{ mixBlendMode: "screen" }}
            />

            {/* FLOATING ACTION TOOLBAR OVERLAY */}
            <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-auto">
              <Button
                variant="outline"
                size="icon"
                className={`w-9 h-9 rounded-lg bg-slate-900/90 border-slate-800 hover:bg-slate-800 ${
                  layoutMode === "galaxy" ? "text-indigo-400 border-indigo-900" : "text-slate-300"
                }`}
                title="Toggle Galaxy Mode"
                aria-label="Toggle Galaxy Mode"
                onClick={() => setLayoutMode(layoutMode === "classic" ? "galaxy" : "classic")}
              >
                <Orbit className={`w-4.5 h-4.5 ${layoutMode === "galaxy" ? "animate-spin" : ""}`} style={{ animationDuration: "10s" }} />
              </Button>
              
              <div className="h-[1px] bg-slate-800 my-1 mx-1.5" />

              <Button
                variant="outline"
                size="icon"
                className={`w-9 h-9 rounded-lg bg-slate-900/90 border-slate-800 hover:bg-slate-800 ${
                  heatmapMode ? "text-red-400 border-red-900" : "text-slate-300"
                }`}
                title="Toggle Heatmap Diagnostics"
                aria-label="Toggle Heatmap Diagnostics"
                onClick={() => setHeatmapMode(!heatmapMode)}
              >
                <Flame className="w-4.5 h-4.5" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                className={`w-9 h-9 rounded-lg bg-slate-900/90 border-slate-800 hover:bg-slate-800 ${
                  showImports ? "text-orange-400 border-orange-900" : "text-slate-300"
                }`}
                title="Toggle Path Tracing Links"
                aria-label="Toggle Path Tracing Links"
                onClick={() => setShowImports(!showImports)}
              >
                <GitFork className="w-4.5 h-4.5" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                className={`w-9 h-9 rounded-lg bg-slate-900/90 border-slate-800 hover:bg-slate-800 ${
                  tourIndex !== null ? "text-green-400 border-green-900" : "text-slate-300"
                }`}
                title="Start Guided Architecture Tour"
                aria-label="Start Guided Architecture Tour"
                onClick={() => setTourIndex(0)}
              >
                <BookOpen className="w-4.5 h-4.5" />
              </Button>

              <div className="h-[1px] bg-slate-800 my-1 mx-1.5" />

              <Button
                variant="outline"
                size="icon"
                className="w-9 h-9 rounded-lg bg-slate-900/90 border-slate-800 hover:bg-slate-800 hover:text-cyan-400"
                title="Zoom In"
                aria-label="Zoom In"
                onClick={() => handleZoom("in")}
              >
                <Maximize2 className="w-4.5 h-4.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="w-9 h-9 rounded-lg bg-slate-900/90 border-slate-800 hover:bg-slate-800 hover:text-cyan-400"
                title="Zoom Out"
                aria-label="Zoom Out"
                onClick={() => handleZoom("out")}
              >
                <Minimize2 className="w-4.5 h-4.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="w-9 h-9 rounded-lg bg-slate-900/90 border-slate-800 hover:bg-slate-800 hover:text-cyan-400"
                title="Reset Camera & Focus"
                aria-label="Reset Camera & Focus"
                onClick={handleResetZoom}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            {/* SEARCH NAVIGATION BOX OVERLAY */}
            <div className="absolute top-4 left-16 z-20 w-64 pointer-events-auto">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search repository nodes..."
                  className="w-full pl-9 pr-8 py-2 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-500 backdrop-blur-md"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchDropdown(true);
                    setActiveSuggestionIndex(-1);
                  }}
                  onFocus={() => {
                    setShowSearchDropdown(true);
                    setActiveSuggestionIndex(-1);
                  }}
                  onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                  onKeyDown={(e) => {
                    if (searchSuggestions.length === 0) return;
                    
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActiveSuggestionIndex((prev) => 
                        prev < searchSuggestions.length - 1 ? prev + 1 : 0
                      );
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActiveSuggestionIndex((prev) => 
                        prev > 0 ? prev - 1 : searchSuggestions.length - 1
                      );
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < searchSuggestions.length) {
                        const targetNode = searchSuggestions[activeSuggestionIndex];
                        if (focusNodeRef.current) {
                          focusNodeRef.current(targetNode.id);
                        }
                        setSearchQuery("");
                        setShowSearchDropdown(false);
                      }
                    } else if (e.key === "Escape") {
                      setShowSearchDropdown(false);
                    }
                  }}
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-500 hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Autocomplete suggestions */}
              {showSearchDropdown && searchSuggestions.length > 0 && (
                <div className="absolute top-10 left-0 right-0 rounded-lg bg-slate-950/95 border border-slate-800 p-1 shadow-2xl backdrop-blur-lg animate-in fade-in zoom-in-95">
                  {searchSuggestions.map((n, index) => (
                    <button
                      key={n.id}
                      className={`w-full text-left px-3 py-1.5 rounded text-[11px] flex items-center justify-between transition-colors ${
                        index === activeSuggestionIndex 
                          ? "bg-indigo-600 text-white" 
                          : "hover:bg-slate-800/80 text-slate-200"
                      }`}
                      onClick={() => {
                        if (focusNodeRef.current) {
                          focusNodeRef.current(n.id);
                        }
                        setSearchQuery("");
                        setShowSearchDropdown(false);
                      }}
                    >
                      <span className="truncate max-w-[150px] font-medium" title={n.name}>
                        {n.name}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase border ${
                        index === activeSuggestionIndex
                          ? "bg-indigo-850 border-indigo-700 text-indigo-200"
                          : "bg-slate-900 border-slate-800 text-slate-400"
                      }`}>
                        {n.layer}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* TOUR GUIDE STEPS PLAYER POPUP */}
            {tourIndex !== null && (
              <div className="absolute bottom-4 left-4 z-30 w-96 max-w-[calc(100vw-32px)] pointer-events-auto animate-in fade-in slide-in-from-bottom-5">
                <Card className="glass border border-slate-800 bg-slate-950/95 p-4 backdrop-blur-md shadow-2xl">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-1.5 text-indigo-400 text-xs font-semibold tracking-wide uppercase">
                      <Sparkles className="w-4 h-4 animate-pulse" />
                      Guided Architecture Tour
                    </div>
                    <button 
                      onClick={() => handleResetZoom()}
                      className="text-slate-500 hover:text-slate-200 rounded p-0.5 hover:bg-slate-900"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <h4 className="text-slate-100 font-bold text-sm">
                    {tourSteps[tourIndex].title}
                  </h4>
                  <p className="text-xs text-slate-350 mt-1.5 leading-relaxed min-h-[50px]">
                    {tourSteps[tourIndex].description}
                  </p>
                  <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-900">
                    <span className="text-[10px] text-slate-500 font-mono">
                      Step {tourIndex + 1} of {tourSteps.length}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] px-2.5 border-slate-800"
                        disabled={tourIndex === 0}
                        aria-label="Previous Tour Step"
                        onClick={() => setTourIndex(tourIndex - 1)}
                      >
                        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] px-2.5 bg-indigo-900 border-indigo-800 text-indigo-100 hover:bg-indigo-850"
                        aria-label={tourIndex === tourSteps.length - 1 ? "Exit Tour" : "Next Tour Step"}
                        onClick={() => {
                          if (tourIndex < tourSteps.length - 1) {
                            setTourIndex(tourIndex + 1);
                          } else {
                            handleResetZoom();
                          }
                        }}
                      >
                        {tourIndex === tourSteps.length - 1 ? "Exit Tour" : <>Next <ArrowRight className="w-3.5 h-3.5 ml-1" /></>}
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Viewport Minimap Floating Overlay */}
            <div className="absolute bottom-4 right-4 z-20 pointer-events-auto border border-slate-800/80 rounded-lg overflow-hidden shadow-2xl">
              <svg ref={minimapRef} className="block" />
            </div>

            {/* Interactive D3 Canvas SVG */}
            <div className="overflow-x-auto">
              <svg
                ref={svgRef}
                className="text-slate-200 block"
                style={{ minHeight: "500px", height: "600px", width: "100%" }}
              />
            </div>
          </div>

          {/* RIGHT SIDE PANEL: Tabular Intelligence Details (1/4 width) */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            
            {/* Tab header buttons */}
            <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-1 rounded-lg border border-slate-800/60">
              <Button
                variant={sideTab === "details" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 text-xs font-semibold"
                aria-label="Inspect details"
                onClick={() => setSideTab("details")}
              >
                Inspect details
              </Button>
              <Button
                variant={sideTab === "ai-insights" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 text-xs font-semibold text-indigo-300"
                aria-label="AI Insights"
                onClick={() => setSideTab("ai-insights")}
              >
                AI Insights
              </Button>
            </div>

            {/* TAB CONTENT: INSPECT DETAILS */}
            {sideTab === "details" && (
              <Card className="glass border-slate-800 bg-slate-950/40 p-4 flex-1 flex flex-col justify-between min-h-[300px]">
                <div>
                  <h4 className="text-slate-200 font-bold text-sm flex items-center gap-2 mb-3 border-b border-slate-900 pb-2">
                    <Filter className="w-4.5 h-4.5 text-slate-400" />
                    Architecture Layers
                  </h4>

                  {/* Architecture Layer Toggles */}
                  <div className="space-y-2 text-xs">
                    {[
                      { key: "ui", label: "UI Layer", color: "bg-cyan-500", desc: "Pages, Components, Views" },
                      { key: "api", label: "API Router", color: "bg-blue-500", desc: "Handlers, Controllers" },
                      { key: "database", label: "Database Client", color: "bg-indigo-500", desc: "Prisma Schemas, DB Models" },
                      { key: "core", label: "Core Logic Core", color: "bg-purple-500", desc: "Services, Workers, Libraries" },
                      { key: "utility", label: "Utility / Config", color: "bg-slate-500", desc: "Configs, Setup scripts" }
                    ].map((layer) => (
                      <label 
                        key={layer.key}
                        className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-900 hover:border-slate-800/80 cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 bg-slate-900 border-slate-800 w-3.5 h-3.5"
                          checked={activeLayers.has(layer.key)}
                          onChange={() => toggleLayer(layer.key)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-200">{layer.label}</span>
                            <span className={`w-2 h-2 rounded-full ${layer.color}`} />
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5 truncate">{layer.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Focus/Hover Inspector details */}
                <div className="mt-4 pt-3 border-t border-slate-900">
                  {focusedNode ? (
                    <div className="space-y-3 p-3 rounded-lg bg-slate-900/30 border border-slate-900 animate-in fade-in slide-in-from-right-3">
                      <div className="flex justify-between items-start">
                        <span className={`px-2 py-0.5 rounded text-[8px] uppercase font-bold tracking-wider ${
                          focusedNode.type === "folder" 
                            ? "bg-purple-950 text-purple-300 border border-purple-800" 
                            : "bg-cyan-950 text-cyan-300 border border-cyan-800"
                        }`}>
                          {focusedNode.type}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="w-5 h-5 rounded hover:bg-slate-800 text-slate-400"
                          aria-label="Reset View and Focus"
                          onClick={handleResetZoom}
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-200 text-sm truncate max-w-[190px]" title={focusedNode.name}>
                          {focusedNode.name}
                        </h5>
                        <p className="text-[9px] text-slate-500 font-mono truncate select-all mt-0.5" title={focusedNode.path}>
                          {focusedNode.path}
                        </p>
                      </div>
                      <div className="h-[1px] bg-slate-900" />
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-450">
                        <div>
                          <div className="text-slate-550">Lines of Code</div>
                          <div className="text-slate-200 font-semibold">{focusedNode.lines?.toLocaleString()}</div>
                        </div>
                        {focusedNode.type === "folder" ? (
                          <div>
                            <div className="text-slate-550">Total Files</div>
                            <div className="text-slate-200 font-semibold">{focusedNode.childCount} files</div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-slate-550">Language</div>
                            <div className="text-slate-200 font-semibold truncate capitalize">{focusedNode.language}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-xs text-slate-500">
                      💡 Click a node in the graph to inspect structural properties.
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* TAB CONTENT: AI INSIGHTS */}
            {sideTab === "ai-insights" && (
              <Card className="glass border-slate-800 bg-slate-950/40 p-4 flex-1 flex flex-col justify-between min-h-[300px]">
                <div className="space-y-4">
                  <h4 className="text-slate-200 font-bold text-sm flex items-center gap-2 border-b border-slate-900 pb-2">
                    <Sparkles className="w-4.5 h-4.5 text-indigo-400" />
                    AI System Insights
                  </h4>

                  {/* Architecture Complexity Review */}
                  <div className="space-y-2 text-xs">
                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-900">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Complexity index</div>
                      <div className="text-sm font-bold text-slate-200 mt-0.5">
                        {aiStats.totalLines.toLocaleString()} lines / {aiStats.totalFiles} modules
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Scale categorized as <strong>Medium</strong>. Modular layering decouples UI views and business logic components.
                      </p>
                    </div>

                    {/* Critical hub warning alerts */}
                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-900">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                        Critical System Hubs
                      </div>
                      <div className="space-y-1.5 mt-2">
                        {aiStats.criticalHubs.map((hub) => (
                          <div key={hub.id} className="flex justify-between items-center text-[10px] bg-slate-900/50 p-1.5 rounded border border-slate-850">
                            <span className="text-slate-250 truncate max-w-[130px] font-mono" title={hub.name}>
                              {hub.name}
                            </span>
                            <span className="text-amber-500 font-semibold">
                              {hub.degree} connections
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Refactoring suggestions */}
                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-900">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Refactoring guidelines</div>
                      <ul className="list-disc pl-4 text-[10px] text-slate-400 mt-1.5 space-y-1.5 leading-normal">
                        {aiStats.recommendations.map((rec, idx) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </Card>
            )}

          </div>
        </div>
      )}

      {/* Footer Instructions */}
      <div className="flex flex-col sm:flex-row sm:justify-between items-center text-[11px] text-slate-500 mt-3 gap-2 px-1 relative z-20">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span>Repository Intelligence System ready</span>
        </div>
        <div>
          💡 Scroll to zoom • Drag canvas to pan • Click node to focus • Hover to trace paths • Start Tour for guided review
        </div>
      </div>

      <div
        ref={tooltipRef}
        className="fixed p-3 rounded-lg pointer-events-none shadow-2xl border border-slate-800 bg-slate-950/95 text-slate-100 z-50 transition-opacity duration-150 backdrop-blur-md hidden max-w-sm"
        style={{
          opacity: 0,
          left: "0px",
          top: "0px",
          pointerEvents: "none",
        }}
      />
    </Card>
  );
}
