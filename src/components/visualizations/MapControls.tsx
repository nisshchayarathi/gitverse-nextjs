import React from "react";
import { Plus, Minus, Maximize2 } from "lucide-react";

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function MapControls({ onZoomIn, onZoomOut, onReset }: MapControlsProps) {
  return (
    <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-20">
      <div 
        className="flex flex-col rounded-xl border border-white/10 bg-slate-900/80 dark:bg-slate-950/80 backdrop-blur-xl shadow-2xl p-1.5 gap-1.5 transition-all duration-300 hover:border-white/20"
        role="group"
        aria-label="Graph Zoom and Pan Controls"
      >
        <button
          onClick={onZoomIn}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/15 active:bg-white/25 text-white hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
          aria-label="Zoom In"
          title="Zoom In"
        >
          <Plus className="h-4 w-4" />
        </button>
        
        <button
          onClick={onZoomOut}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/15 active:bg-white/25 text-white hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
          aria-label="Zoom Out"
          title="Zoom Out"
        >
          <Minus className="h-4 w-4" />
        </button>

        <div className="h-[1px] bg-white/10 my-0.5" />

        <button
          onClick={onReset}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/15 active:bg-white/25 text-white hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
          aria-label="Reset View"
          title="Reset View (Center Graph)"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
