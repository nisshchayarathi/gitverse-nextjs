import { Skeleton } from "@/components/ui/Skeleton";

export function AnalysisDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header row — job title + status badge + timestamp */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64" />       {/* Title */}
          <Skeleton className="h-4 w-40" />       {/* Subtitle / repo name */}
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-20 rounded-full" />  {/* Status badge */}
          <Skeleton className="h-4 w-28" />               {/* Timestamp */}
        </div>
      </div>

      {/* Metrics row — 3 or 4 stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />   {/* Metric label */}
            <Skeleton className="h-8 w-16" />   {/* Metric value */}
          </div>
        ))}
      </div>

      {/* Main content — two-column layout or single wide panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Primary panel (2/3 width on large screens) */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Skeleton className="h-6 w-32" />          {/* Section heading */}
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="mt-2 h-48 w-full rounded-lg" /> {/* Code/result block */}
        </div>

        {/* Sidebar (1/3 width on large screens) */}
        <div className="flex flex-col gap-4">
          <Skeleton className="h-6 w-24" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
