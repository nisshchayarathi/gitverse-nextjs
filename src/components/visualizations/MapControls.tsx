import React, { useState, useRef, useEffect } from "react";
import { Plus, Minus, Maximize2, Download, Image as ImageIcon, Loader2 } from "lucide-react";

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onExportPng?: () => void;
  onExportSvg?: (mode: "current" | "full") => void;
  isExporting?: boolean;
}

export function MapControls({
  onZoomIn,
  onZoomOut,
  onReset,
  onExportPng,
  onExportSvg,
  isExporting,
}: MapControlsProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-30">
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
          <div className="relative flex flex-col items-center" ref={dropdownRef}>
            <div className="h-[1px] w-full bg-white/10 my-0.5" />
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              disabled={isExporting}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/15 active:bg-white/25 text-white hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Download options"
              title="Download Map"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 bottom-full mb-2 w-48 rounded-xl border border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-2xl p-1.5 flex flex-col gap-1 z-40 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <button
                  onClick={() => {
                    onExportPng();
                    setDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-white/10 text-white flex items-center gap-2 transition-colors focus:outline-none focus:bg-white/10"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>Export PNG</span>
                </button>
                <button
                  onClick={() => {
                    onExportSvg("current");
                    setDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-white/10 text-white flex items-center gap-2 transition-colors focus:outline-none focus:bg-white/10"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export SVG (Current View)</span>
                </button>
                <button
                  onClick={() => {
                    onExportSvg("full");
                    setDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-white/10 text-white flex items-center gap-2 transition-colors focus:outline-none focus:bg-white/10"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export SVG (Full Map)</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
