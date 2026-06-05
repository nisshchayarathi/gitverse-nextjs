"use client";

import { Card, CardContent } from "@/components/ui";
import { InsightMetric } from "../../lib/repositoryInsights";
import { TrendingUp, TrendingDown } from "lucide-react";

interface InsightCardProps {
  insight: InsightMetric;
  className?: string;
}

export function InsightCard({ insight, className = "" }: InsightCardProps) {
  return (
    <Card className={`glass border border-border/70 transition-all duration-300 hover:shadow-md ${className}`}>
      <CardContent className="pt-6">
        <div className="space-y-3">
          {/* Header with icon and badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-xs sm:text-sm font-semibold text-muted-foreground mb-1">
                {insight.title}
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-xl sm:text-2xl font-bold text-foreground truncate">
                  {insight.value}
                </p>
                {insight.icon && (
                  <span className="text-lg sm:text-xl flex-shrink-0">
                    {insight.icon}
                  </span>
                )}
              </div>
            </div>

            {insight.badge && (
              <span className="inline-block rounded-full px-2 py-1 text-xs font-semibold bg-primary/10 text-primary ring-1 ring-primary/20 flex-shrink-0">
                {insight.badge}
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-xs sm:text-sm text-muted-foreground">
            {insight.description}
          </p>

          {/* Trend indicator */}
          {insight.trend && (
            <div className="flex items-center gap-1 pt-1">
              {insight.trend === "up" && (
                <>
                  <TrendingUp className="h-3 w-3 text-emerald-600" />
                  <span className="text-xs text-emerald-600 font-medium">
                    Trending up
                  </span>
                </>
              )}
              {insight.trend === "down" && (
                <>
                  <TrendingDown className="h-3 w-3 text-red-600" />
                  <span className="text-xs text-red-600 font-medium">
                    Trending down
                  </span>
                </>
              )}
              {insight.trend === "stable" && (
                <span className="text-xs text-gray-600 font-medium">
                  Stable
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
