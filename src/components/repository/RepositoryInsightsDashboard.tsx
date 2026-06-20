"use client";

import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, EmptyState, Button } from "@/components/ui";
import { InsightCard } from "./InsightCard";
import { RepositorySummaryCard } from "./RepositorySummaryCard";
import { deriveRepositoryInsights } from "../../lib/repositoryInsights";
import DependencyRiskPanel from "./DependencyRiskPanel";
import { BarChart3, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RepositoryInsightsDashboardProps {
  repositoryData?: any;
  className?: string;
}

export function RepositoryInsightsDashboard({
  repositoryData,
  className = "",
}: RepositoryInsightsDashboardProps) {
  const { toast } = useToast();

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Repository Analysis | GitVerse',
          text: 'Check out this repository analysis on GitVerse!',
          url: url,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          copyToClipboard(url);
        }
      }
    } else {
      copyToClipboard(url);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Link Copied!",
      description: "Analysis link has been copied to your clipboard.",
    });
  };

  const { insights, summary } = useMemo(() => {
    if (!repositoryData) {
      return { insights: [], summary: { totalModules: 0, totalConnections: 0, totalHotspots: 0, overallComplexity: "Low" as const } };
    }
    return deriveRepositoryInsights(repositoryData);
  }, [repositoryData]);

  const repoId = repositoryData?.id ? Number(repositoryData.id) : null;
  const hasData = (repositoryData?.files?.length || 0) > 0;

  if (!hasData) {
    return (
      <Card className={`glass border border-border/70 ${className}`}>
        <CardHeader>
          <CardTitle className="text-base">📊 Repository Insights</CardTitle>
          <CardDescription>
            Insights about your repository structure and activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={BarChart3}
            title="No insights available"
            description="Repository data is still being analyzed. Check back soon."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main title */}
      <Card className="glass border border-border/70">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1.5">
            <CardTitle className="text-lg">📊 Repository Insights Dashboard</CardTitle>
            <CardDescription>
              Key metrics and insights about your repository structure and activity
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleShare} className="flex items-center gap-2">
            <Share2 className="w-4 h-4" />
            Share
          </Button>
        </CardHeader>
      </Card>

      {/* Summary Section */}
      <RepositorySummaryCard summary={summary} />

      {/* Insights Grid */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Key Insights</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {insights.map((insight, index) => (
            <InsightCard
              key={`${insight.title}-${index}`}
              insight={insight}
              className="h-full"
            />
          ))}
        </div>
      </div>

      {/* Dependency Risk Panel */}
      {repoId && <DependencyRiskPanel repositoryId={repoId} />}

      {/* Learning Tip */}
      <div className="rounded-lg border border-amber-300/40 bg-amber-500/5 p-4 space-y-2">
        <p className="text-sm font-semibold text-amber-900">💡 Contributing Tip</p>
        <p className="text-xs text-amber-800">
          Focus on understanding the most active modules first. These are often the
          most critical parts of the codebase where most development happens.
        </p>
      </div>
    </div>
  );
}
