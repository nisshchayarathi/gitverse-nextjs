"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import {
  FOLDER_IMPORTANCE,
  ImportanceCategory,
  getCategoryColor,
} from "@/config/folderImportance";
import { FolderImportanceBadge } from "./FolderImportanceBadge";

const CATEGORIES: ImportanceCategory[] = [
  "Critical Area",
  "Core Module",
  "Supporting Area",
  "Documentation",
];

export function FolderImportanceGuide() {
  const foldersByCategory = CATEGORIES.map((category) => ({
    category,
    folders: Object.entries(FOLDER_IMPORTANCE)
      .filter(([_, info]) => info.label === category)
      .slice(0, 5),
  }));

  return (
    <Card className="glass border border-border/70 transition-all duration-300">
      <CardHeader>
        <CardTitle className="text-base">📁 Repository Structure Guide</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {foldersByCategory.map(({ category, folders }) => {
          const { bg, text, ring } = getCategoryColor(category);

          return (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ring-1 ${bg} ${text} ${ring}`}
                >
                  {category}
                </span>
              </div>

              <div className="space-y-2 pl-2">
                {folders.map(([folderName, info]) => (
                  <div
                    key={folderName}
                    className="flex flex-col gap-2 rounded-lg border border-border/30 bg-muted/30 p-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium capitalize">{folderName}</p>
                      <p className="text-xs text-muted-foreground">{info.description}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <div className="text-sm font-semibold">
                        {"⭐".repeat(info.level)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="rounded-lg border border-amber-300/40 bg-amber-500/5 p-3 text-xs text-amber-700">
          <p className="font-semibold">💡 Tip:</p>
          <p className="mt-1">
            Critical areas (5 stars) require careful attention when making changes. Core
            modules (3-4 stars) are essential to application functionality. Supporting areas
            (1-2 stars) are helper utilities.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
