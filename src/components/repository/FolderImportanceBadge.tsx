"use client";

import { ImportanceLevel, ImportanceCategory, getCategoryColor } from "@/config/folderImportance";

interface FolderImportanceBadgeProps {
  level: ImportanceLevel;
  label: ImportanceCategory;
  className?: string;
  showLabel?: boolean;
}

export function FolderImportanceBadge({
  level,
  label,
  className = "",
  showLabel = true,
}: FolderImportanceBadgeProps) {
  const { bg, text, ring } = getCategoryColor(label);
  const stars = "⭐".repeat(level);

  return (
    <div className={`inline-flex flex-col gap-1 ${className}`}>
      <div className="text-sm font-semibold tracking-tight">{stars}</div>
      {showLabel && (
        <span
          className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${bg} ${text} ${ring}`}
          aria-label={`${label} - ${level} out of 5 importance`}
        >
          {label}
        </span>
      )}
    </div>
  );
}
