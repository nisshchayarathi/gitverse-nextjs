import { useEffect, useRef, useState } from "react";
import * as htmlToImage from "html-to-image";
import * as d3 from "d3";
import { Card } from "@/components/ui";
import { GraphAnalyzer } from "@/utils/graphAnalyzer";
import { MapControls } from "./MapControls";
import { toast } from "sonner";

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
  
  const graphAnalyzer = new GraphAnalyzer();
  const graphData = graphAnalyzer.buildDependencyGraph(repository?.files || []);

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
            </div>
            <div className="absolute bottom-2 right-3 text-[10px] text-white/70">
              GitVerse • {repository?.name || "Repository"}
            </div>
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
          💡 Drag nodes to reposition • Scroll to zoom • Hover for details
        </p>

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
      </Card>
    </div>
  );
}
