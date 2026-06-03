import { ReactNode } from "react";

export type DifficultyLevel = "beginner" | "intermediate" | "advanced";

const badgeStyles: Record<DifficultyLevel, string> = {
  beginner:
    "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20",
  intermediate:
    "bg-amber-400/10 text-amber-700 ring-1 ring-amber-400/20",
  advanced: "bg-red-500/10 text-red-600 ring-1 ring-red-500/20",
};

const labelMap: Record<DifficultyLevel, string> = {
  beginner: "🟢 Beginner",
  intermediate: "🟡 Intermediate",
  advanced: "🔴 Advanced",
};

interface DifficultyBadgeProps {
  level: DifficultyLevel;
  className?: string;
}

export function DifficultyBadge({ level, className = "" }: DifficultyBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badgeStyles[level]} ${className}`}
      aria-label={`${labelMap[level]} difficulty`}
    >
      {labelMap[level]}
    </span>
  );
}
