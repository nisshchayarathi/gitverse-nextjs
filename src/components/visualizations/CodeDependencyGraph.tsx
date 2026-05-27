import { useEffect, useRef } from "react";
import * as htmlToImage from "html-to-image";
import * as d3 from "d3";
import { Card } from "@/components/ui";
import { GraphAnalyzer } from "@/utils/graphAnalyzer";
import { MapControls } from "./MapControls";

interface RepositoryFile {
  path: string;
  lines?: number;
}

interface Repository {
  files?: RepositoryFile[];
}

// Generate dependency graph from repository files
const generateDependencyGraph = (repository?: Repository): GraphData => {
  const nodes: Node[] = [];
  const links: Link[] = [];

  if (!repository?.files || repository.files.length === 0) {
    return { nodes: [], links: [] };
  }

  // Extract unique folders and create nodes
  const files = repository.files;

  // Create folder nodes
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
    nodes.push({
      id: `folder-${folderPath}`,
      name: folderName,
      type: "folder",
      size: 100,
      path: folderPath,
    });
  });

  // Add file nodes (limit to top files by lines to avoid clutter)
  const topFiles = files
    .sort((a, b) => (b.lines || 0) - (a.lines || 0))
    .slice(0, 30);

  topFiles.forEach((file) => {
    const fileName = file.path.split("/").pop() || file.path;
    nodes.push({
      id: `file-${file.path}`,
      name: fileName,
      type: "file",
      size: Math.min(Math.max((file.lines ?? 0) / 10 || 50, 40), 150),
      path: file.path,
    });
  });

  // Create links: files to their parent folders
  topFiles.forEach((file) => {
    const parts = file.path.split("/");
    if (parts.length > 1) {
      const parentFolder = parts.slice(0, -1).join("/");
      links.push({
        source: `file-${file.path}`,
        target: `folder-${parentFolder}`,
        strength: 1,
      });
    }
  });

  // Create links between folders (parent-child relationships)
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


interface CodeDependencyGraphProps {
  repository?: Repository;
}

export function CodeDependencyGraph({ repository }: CodeDependencyGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const zoomRef = useRef<any>(null);
  const svgSelectionRef = useRef<any>(null);
  
  const graphAnalyzer = new GraphAnalyzer();
  const graphData = graphAnalyzer.buildDependencyGraph(repository?.files || []);
  const exportGraph = async (format: "png" | "svg") => {
    if (!exportRef.current) return;

    try {
      const options = {
        backgroundColor: "#0f172a",
        pixelRatio: 2,
        cacheBust: true,
      };

      const dataUrl =
        format === "png"
          ? await htmlToImage.toPng(exportRef.current, options)
          : await htmlToImage.toSvg(exportRef.current);

      const link = document.createElement("a");
      link.download = `gitverse-graph.${format}`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  const handleZoomIn = () => {
    if (svgSelectionRef.current && zoomRef.current) {
      svgSelectionRef.current
        .transition()
        .duration(300)
        .call(zoomRef.current.scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (svgSelectionRef.current && zoomRef.current) {
      svgSelectionRef.current
        .transition()
        .duration(300)
        .call(zoomRef.current.scaleBy, 1 / 1.3);
    }
  };

  const handleReset = () => {
    if (svgSelectionRef.current && zoomRef.current) {
      svgSelectionRef.current
        .transition()
        .duration(500)
        .call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };

  useEffect(() => {
    if (!svgRef.current) return;

    // If no data, show empty state
    if (graphData.nodes.length === 0) {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();
      svg
        .append("text")
        .attr("x", "50%")
        .attr("y", "50%")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "rgba(255,255,255,0.4)")
        .text("No files found in repository");
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
    const nodes = graphData.nodes.map((d) => ({ ...d }));
    const links = graphData.links.map((d) => ({ ...d }));

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
      .attr("stroke", (d: any) =>
        d.isCyclic ? "#ef4444" : "rgba(255,255,255,0.2)",
      )
      .attr("stroke-width", (d: any) => d.strength * 2)
      .attr("stroke-dasharray", (d: any) => (d.isCyclic ? "5,5" : "none"))
      .attr("stroke-opacity", 0.6);

    // Draw nodes
    const node = g
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
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
          .on("end", (_event: any, d: any) => {
            if (!d.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

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
      .on("mouseleave", function () {
        if (tooltipRef.current) {
          d3.select(tooltipRef.current)
            .style("opacity", "0")
            .style("display", "none");
        }
      })
      .on("mouseleave", function (_event: any, d: any) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", d.size / 3)
          .attr("stroke", "rgba(255,255,255,0.3)")
          .attr("stroke-width", 2);

        link
          .transition()
          .duration(200)
          .attr("stroke", (l: any) =>
            l.isCyclic ? "#ef4444" : "rgba(255,255,255,0.2)",
          )
          .attr("stroke-opacity", 0.6);

        if (tooltipRef.current) {
          d3.select(tooltipRef.current).style("opacity", 0);
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
    });

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom as any);

    // Save D3 zoom behavior and SVG selection for programmatic triggers
    zoomRef.current = zoom;
    svgSelectionRef.current = svg;

    // Animate nodes on load
    node
      .selectAll("circle")
      .attr("r", 0)
      .transition()
      .duration(500)
      .delay((_d: any, i: number) => i * 30)
      .attr("r", (d: any) => d.size / 3);

    return () => {
      simulation.stop();
    };
  }, [repository]);

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
            <div className="relative">
              <details className="group">
                <summary className="list-none cursor-pointer px-3 py-1 rounded-md bg-primary text-primary-foreground">
                  Export
                </summary>

                <div className="absolute right-0 mt-2 w-40 rounded-md border bg-background shadow-lg z-50 overflow-hidden">
                  <button
                    onClick={() => exportGraph("png")}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-muted"
                  >
                    Download PNG
                  </button>

                  <button
                    onClick={() => exportGraph("svg")}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-muted"
                  >
                    Download SVG
                  </button>
                </div>
              </details>
            </div>
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
        <div
          ref={exportRef}
          className="glass rounded-lg p-4 sm:p-6 relative overflow-visible"
        >
          <h3 className="text-base sm:text-lg font-semibold mb-4">
            Code Dependencies
          </h3>
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <svg
              ref={svgRef}
              width="100%"
              height="auto"
              className="text-foreground min-h-96 sm:min-h-96"
              style={{ background: "rgba(0,0,0,0.2)", minHeight: "300px" }}
              viewBox="0 0 900 600"
              preserveAspectRatio="xMidYMid meet"
            />
          </div>
          <div className="absolute bottom-2 right-3 text-[10px] text-white/70">
            GitVerse • {repository?.name || "Repository"}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 px-4 sm:px-0">
          💡 Drag nodes to reposition • Scroll to zoom • Hover for details
        </p>
        <div
          ref={tooltipRef}
          className="
      </div>
      <div className="glass rounded-lg p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold mb-4">
          Code Dependencies
        </h3>
        <div className="relative overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <svg
            ref={svgRef}
            width="100%"
            height="auto"
            className="text-foreground min-h-96 sm:min-h-96"
            style={{ background: "rgba(0,0,0,0.2)", minHeight: "300px" }}
            viewBox="0 0 900 600"
            preserveAspectRatio="xMidYMid meet"
          />
          <MapControls 
            onZoomIn={handleZoomIn} 
            onZoomOut={handleZoomOut} 
            onReset={handleReset} 
          />
        </div>

      </div>
      <p className="text-xs text-muted-foreground mt-2 px-4 sm:px-0">
        💡 Drag nodes to reposition • Scroll to zoom • Hover for details
      </p>
      <div
  ref={tooltipRef}
  className="
    fixed p-3 rounded-lg pointer-events-none shadow-xl border
    translate-x-[-120px] translate-y-[-120px]
    sm:translate-x-[-250px] sm:translate-y-[-250px]
  "
          style={{
            opacity: 0, // control with state later
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            color: "white",
            zIndex: 9999,
            backdropFilter: "blur(8px)",
            left: "0px",
            top: "0px",
            whiteSpace: "nowrap",
          }}
        />
      </Card>
    </div>
  );
}
