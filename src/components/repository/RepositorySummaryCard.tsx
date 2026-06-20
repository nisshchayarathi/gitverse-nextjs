"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { RepositorySummary } from "../../lib/repositoryInsights";
import { Activity, GitBranch, Zap, AlertCircle } from "lucide-react";

interface RepositorySummaryCardProps {
    summary: RepositorySummary;
    className?: string;
}


export function RepositorySummaryCard({
    summary,
    className = "",
}: RepositorySummaryCardProps) {
    const complexityColors = {
        Low: "text-emerald-600 bg-emerald-500/10",
        Medium: "text-amber-700 bg-amber-500/10",
        High: "text-red-600 bg-red-500/10",
    };

    const complexityColor = complexityColors[summary.overallComplexity];

    return (
        <Card className={`glass border border-border/70 transition-all duration-300 ${className}`}>
            <CardHeader>
                <CardTitle className="text-base">📊 Repository Summary</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Summary grid */}
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                    {/* Total Modules */}
                    <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <GitBranch className="h-3 w-3" />
                            Total Modules
                        </p>
                        <p className="text-2xl font-bold text-foreground">
                            {summary.totalModules}
                        </p>
                    </div>

                    {/* Total Connections */}
                    <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            Files
                        </p>
                        <p className="text-2xl font-bold text-foreground">
                            {summary.totalConnections}
                        </p>
                    </div>

                    {/* Total Hotspots */}
                    <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            Hotspots
                        </p>
                        <p className="text-2xl font-bold text-foreground">
                            {summary.totalHotspots}
                        </p>
                    </div>

                    {/* Overall Complexity */}
                    <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Complexity
                        </p>
                        <p
                            className={`text-lg font-bold ${complexityColor} rounded px-2 py-1 inline-block`}
                        >
                            {summary.overallComplexity}
                        </p>
                    </div>
                </div>

                {/* Help text */}
                <div className="rounded-lg border border-blue-300/40 bg-blue-500/5 p-3 text-xs text-blue-700">
                    <p>
                        <strong>Tip:</strong> Use these insights to navigate the codebase
                        and identify high-activity modules.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
