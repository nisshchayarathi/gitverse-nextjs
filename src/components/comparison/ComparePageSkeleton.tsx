import React from "react";

export function ComparePageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-3">
          <div className="h-9 w-64 bg-white/5 rounded-lg" />
          <div className="h-4 w-96 bg-white/5 rounded-lg" />
        </div>
        <div className="h-10 w-36 bg-white/5 rounded-lg" />
      </div>

      {/* Grid of Header Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass border border-border/20 rounded-2xl p-6 h-64 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="h-7 w-40 bg-white/5 rounded-lg" />
            <div className="h-4 w-2/3 bg-white/5 rounded-lg" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-12 bg-white/5 rounded-xl" />
            ))}
          </div>
        </div>

        <div className="glass border border-border/20 rounded-2xl p-6 h-64 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="h-7 w-40 bg-white/5 rounded-lg" />
            <div className="h-4 w-2/3 bg-white/5 rounded-lg" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-12 bg-white/5 rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      {/* Language Comparison Chart Skeleton */}
      <div className="glass border border-border/20 rounded-2xl p-6 h-[400px] flex flex-col justify-between">
        <div className="space-y-3">
          <div className="h-6 w-48 bg-white/5 rounded-lg" />
          <div className="h-4 w-80 bg-white/5 rounded-lg" />
        </div>
        <div className="h-[280px] bg-white/5 rounded-xl w-full" />
      </div>

      {/* Contributor Overlap Skeleton */}
      <div className="glass border border-border/20 rounded-2xl p-6 h-[350px] flex flex-col justify-between">
        <div className="flex justify-between items-center">
          <div className="space-y-3">
            <div className="h-6 w-48 bg-white/5 rounded-lg" />
            <div className="h-4 w-80 bg-white/5 rounded-lg" />
          </div>
          <div className="h-8 w-40 bg-white/5 rounded-lg" />
        </div>
        <div className="h-[220px] bg-white/5 rounded-xl w-full" />
      </div>
    </div>
  );
}
