"use client";

import { Star, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, EmptyState, Button } from "@/components/ui";
import { BookmarkedModules } from "@/hooks/useModuleBookmarks";

interface SavedModulesPanelProps {
  bookmarkedModules: BookmarkedModules;
  onRemoveBookmark: (moduleName: string) => void;
  className?: string;
}

export function SavedModulesPanel({
  bookmarkedModules,
  onRemoveBookmark,
  className = "",
}: SavedModulesPanelProps) {
  const hasBookmarks = bookmarkedModules.length > 0;

  return (
    <Card className={`glass border border-border/70 transition-all duration-300 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
          <div>
            <CardTitle className="text-base">Saved Modules</CardTitle>
            <CardDescription>
              {hasBookmarks
                ? `${bookmarkedModules.length} bookmarked module${bookmarkedModules.length !== 1 ? "s" : ""}`
                : "No saved modules yet"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {hasBookmarks ? (
          <div className="space-y-2">
            {bookmarkedModules.map((moduleName) => (
              <div
                key={moduleName}
                className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-3 py-2 hover:bg-muted/50 transition-all duration-200"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Star className="h-4 w-4 fill-yellow-500 text-yellow-500 flex-shrink-0" />
                  <span className="text-sm font-medium truncate capitalize">
                    {moduleName}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveBookmark(moduleName)}
                  className="h-auto px-2 py-1 ml-2 flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Remove ${moduleName} from bookmarks`}
                  title="Remove bookmark"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Star}
            title="No bookmarked modules"
            description="Bookmark important repository areas to revisit them later."
          />
        )}
      </CardContent>
    </Card>
  );
}
