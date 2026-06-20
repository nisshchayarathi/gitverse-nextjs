"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import {
  FolderImportanceInfo,
  getCategoryColor,
} from "@/config/folderImportance";
import { FolderImportanceBadge } from "./FolderImportanceBadge";

interface FolderImportanceCardProps {
  folderName: string;
  importance: FolderImportanceInfo;
  className?: string;
}

export function FolderImportanceCard({
  folderName,
  importance,
  className = "",
}: FolderImportanceCardProps) {
  const { bg, text, ring } = getCategoryColor(importance.label);

  return (
    <Card className={`glass border border-border/70 transition-all duration-300 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <CardTitle className="text-base capitalize">{folderName}</CardTitle>
            <CardDescription className="mt-1">{importance.description}</CardDescription>
          </div>
          <div className="flex-shrink-0">
            <FolderImportanceBadge
              level={importance.level}
              label={importance.label}
              showLabel={true}
            />
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
