import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface MiniMapProps {
  nodes: any[];
  links: any[];
  width: number;
  height: number;
  svgRef: React.RefObject<SVGSVGElement>;
  transform: { x: number, y: number, k: number };
}

export function MiniMap({ nodes, links, width, height, svgRef, transform }: MiniMapProps) {
  const minimapRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!minimapRef.current || !nodes.length) return;

    const svg = d3.select(minimapRef.current);
    svg.selectAll('*').remove();

    const minimapWidth = 150;
    const minimapHeight = 150 * (height / width);

    // Calculate bounds of the actual graph
    const minX = d3.min(nodes, d => (d.x as number) - (d.size || 10)) || 0;
    const maxX = d3.max(nodes, d => (d.x as number) + (d.size || 10)) || width;
    const minY = d3.min(nodes, d => (d.y as number) - (d.size || 10)) || 0;
    const maxY = d3.max(nodes, d => (d.y as number) + (d.size || 10)) || height;

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;

    // Scale to fit minimap
    const scale = Math.min(minimapWidth / graphWidth, minimapHeight / graphHeight) * 0.9;
    const offsetX = (minimapWidth - graphWidth * scale) / 2 - minX * scale;
    const offsetY = (minimapHeight - graphHeight * scale) / 2 - minY * scale;

    const g = svg.append('g').attr('transform', `translate(${offsetX},${offsetY}) scale(${scale})`);

    // Draw links
    g.selectAll('line')
      .data(links)
      .join('line')
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y)
      .attr('stroke', 'rgba(255,255,255,0.2)')
      .attr('stroke-width', 1);

    // Draw nodes
    g.selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', d => (d.size || 10) / 3)
      .attr('fill', d => d.type === 'folder' ? '#8b5cf6' : '#3b82f6');

    // Draw viewport rectangle
    const viewportWidth = width / transform.k;
    const viewportHeight = height / transform.k;
    const viewportX = -transform.x / transform.k;
    const viewportY = -transform.y / transform.k;

    svg.append('rect')
      .attr('x', viewportX * scale + offsetX)
      .attr('y', viewportY * scale + offsetY)
      .attr('width', viewportWidth * scale)
      .attr('height', viewportHeight * scale)
      .attr('fill', 'rgba(255,255,255,0.1)')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 1)
      .attr('pointer-events', 'none');

  }, [nodes, links, width, height, transform]);

  if (!nodes.length) return null;

  return (
    <div className="absolute bottom-20 right-4 bg-slate-900/80 border border-slate-700 rounded-lg shadow-lg p-2 backdrop-blur-sm pointer-events-none z-10">
      <svg ref={minimapRef} width={150} height={150 * (height / width)} />
    </div>
  );
}
