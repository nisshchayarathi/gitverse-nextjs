import React from "react";
import { Plus, Minus, Maximize2, Download, Image as ImageIcon, Loader2, Flame } from "lucide-react";

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onExportPng?: () => void;
  onExportSvg?: () => void;
  isExporting?: boolean;
  heatmapMode?: boolean;
  onToggleHeatmap?: () => void;
}

export function MapControls({ onZoomIn, onZoomOut, onReset, onExportPng, onExportSvg, isExporting, heatmapMode, onToggleHeatmap }: MapControlsProps) {
  return (
    <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-20">
      <div 
        className="flex flex-col rounded-xl border border-white/10 bg-slate-900/80 dark:bg-slate-950/80 backdrop-blur-xl shadow-2xl p-1.5 gap-1.5 transition-all duration-300 hover:border-white/20"
        role="group"
        aria-label="Graph Zoom and Export Controls"
      >
        <button
          onClick={onZoomIn}
          disabled={isExporting}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/15 active:bg-white/25 text-white hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Zoom In"
          title="Zoom In"
        >
          <Plus className="h-4 w-4" />
        </button>
        
        <button
          onClick={onZoomOut}
          disabled={isExporting}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/15 active:bg-white/25 text-white hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Zoom Out"
          title="Zoom Out"
        >
          <Minus className="h-4 w-4" />
        </button>

        <div className="h-[1px] bg-white/10 my-0.5" />

        <button
          onClick={onReset}
          disabled={isExporting}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/15 active:bg-white/25 text-white hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Reset View"
          title="Reset View (Center Graph)"
        >
          <Maximize2 className="h-4 w-4" />
        </button>

        {onExportPng && onExportSvg && (
          <>
            <div className="h-[1px] bg-white/10 my-0.5" />
            <button
              onClick={onExportPng}
              disabled={isExporting}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/15 active:bg-white/25 text-white hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Export PNG"
              title="Export as PNG"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            </button>
            <button
              onClick={onExportSvg}
              disabled={isExporting}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/15 active:bg-white/25 text-white hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Export SVG"
              title="Export as SVG"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </button>
          </>
        )}
        
        {onToggleHeatmap && (
          <>
            <div className="h-[1px] bg-white/10 my-0.5" />
            <button
              onClick={onToggleHeatmap}
              className={`p-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 ${heatmapMode ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' : 'bg-white/5 hover:bg-white/15 text-white active:bg-white/25'} hover:scale-105 active:scale-95`}
              aria-label="Toggle Heatmap Mode"
              title="Toggle Code Churn Heatmap"
            >
              <Flame className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
