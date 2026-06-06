"use client";

import { Star } from "lucide-react";
import { Button } from "@/components/ui";

interface ModuleBookmarkButtonProps {
  moduleName: string;
  isBookmarked: boolean;
  onToggle: (moduleName: string) => void;
  className?: string;
}

export function ModuleBookmarkButton({
  moduleName,
  isBookmarked,
  onToggle,
  className = "",
}: ModuleBookmarkButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onToggle(moduleName)}
      className={`inline-flex items-center gap-1 px-2 py-1 h-auto transition-all duration-200 hover:bg-accent/10 ${className}`}
      aria-label={
        isBookmarked
          ? `Remove ${moduleName} from bookmarks`
          : `Add ${moduleName} to bookmarks`
      }
      title={isBookmarked ? "Remove bookmark" : "Add bookmark"}
    >
      <Star
        className={`h-4 w-4 transition-all duration-200 ${
          isBookmarked
            ? "fill-yellow-500 text-yellow-500"
            : "text-muted-foreground hover:text-yellow-500"
        }`}
      />
    </Button>
  );
}
