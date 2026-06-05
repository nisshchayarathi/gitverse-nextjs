"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, EmptyState } from "@/components/ui";
import { DeadCodeFinding, getCleanupRecommendation } from "@/lib/dead-code-analyzer";
import {
  FileX2,
  ShieldAlert,
  AlertTriangle,
  Info,
  FileCode,
  ExternalLink,
  Trash2,
  Merge,
  Filter,
  Search,
  ChevronDown,
  X,
} from "lucide-react";

interface DeadCodePanelProps {
  files: Array<{ path: string; content?: string }>;
  findings: DeadCodeFinding[];
  className?: string;
}

const confidenceConfig = {
  HIGH: {
    icon: ShieldAlert,
    color: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    label: "High Confidence",
  },
  MEDIUM: {
    icon: AlertTriangle,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    label: "Medium Confidence",
  },
  LOW: {
    icon: Info,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    label: "Low Confidence",
  },
};

const typeLabels: Record<string, string> = {
  component: "Component",
  hook: "Hook",
  utility: "Utility",
  "api-route": "API Route",
  service: "Service",
  page: "Page",
};

export function DeadCodePanel({ files, findings, className = "" }: DeadCodePanelProps) {
  const [confidenceFilter, setConfidenceFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const stats = useMemo(() => {
    return {
      total: findings.length,
      high: findings.filter((f) => f.confidence === "HIGH").length,
      medium: findings.filter((f) => f.confidence === "MEDIUM").length,
      low: findings.filter((f) => f.confidence === "LOW").length,
      byType: findings.reduce((acc, f) => {
        acc[f.type] = (acc[f.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }, [findings]);

  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      if (confidenceFilter && f.confidence !== confidenceFilter) return false;
      if (typeFilter && f.type !== typeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          f.name.toLowerCase().includes(q) ||
          f.filePath.toLowerCase().includes(q) ||
          f.reason.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [findings, confidenceFilter, typeFilter, searchQuery]);

  if (!findings.length) {
    return (
      <Card className={`glass border border-border/70 ${className}`}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileX2 className="h-5 w-5 text-emerald-500" />
            Dead Code Analysis
          </CardTitle>
          <CardDescription>
            Scan results for unused exports across the repository
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={FileX2}
            title="No dead code found"
            description="All exported symbols in this repository appear to be in use. Great job keeping things clean!"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <Card className="glass border border-border/70">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileX2 className="h-5 w-5 text-rose-500" />
            Dead Code Analysis
          </CardTitle>
          <CardDescription>
            {findings.length} potentially unused export{findings.length !== 1 ? "s" : ""} found across {files.length} file{files.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="glass border border-border/70">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileX2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="glass border border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">High</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-500">{stats.high}</p>
          </CardContent>
        </Card>
        <Card className="glass border border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Medium</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-amber-500">{stats.medium}</p>
          </CardContent>
        </Card>
        <Card className="glass border border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Low</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-blue-500">{stats.low}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass border border-border/70">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search findings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {["HIGH", "MEDIUM", "LOW"].map((level) => (
                <button
                  key={level}
                  onClick={() => setConfidenceFilter(confidenceFilter === level ? null : level)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    confidenceFilter === level
                      ? `${confidenceConfig[level as keyof typeof confidenceConfig].bg} ${confidenceConfig[level as keyof typeof confidenceConfig].color} ${confidenceConfig[level as keyof typeof confidenceConfig].border}`
                      : "bg-white/5 text-muted-foreground hover:bg-white/10"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {filteredFindings.length === 0 ? (
            <div className="py-8 text-center">
              <Filter className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No findings match the current filters</p>
              <button
                onClick={() => {
                  setConfidenceFilter(null);
                  setTypeFilter(null);
                  setSearchQuery("");
                }}
                className="text-xs text-primary hover:underline mt-2"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFindings.map((finding, idx) => {
                const config = confidenceConfig[finding.confidence];
                const Icon = config.icon;
                return (
                  <div
                    key={`${finding.filePath}:${finding.name}:${idx}`}
                    className="group rounded-lg border border-border/40 bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-200"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className={`p-1.5 rounded-md ${config.bg} mt-0.5 flex-shrink-0`}>
                            <Icon className={`h-4 w-4 ${config.color}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-semibold truncate max-w-[300px]">
                                {finding.name}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${config.bg} ${config.color}`}>
                                {finding.confidence}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 text-muted-foreground uppercase tracking-wider">
                                {typeLabels[finding.type] || finding.type}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {finding.reason}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-[11px] font-mono text-muted-foreground/70 truncate">
                                {finding.filePath}:{finding.exportLine}
                              </span>
                              {finding.suggestion && (
                                <span className="text-[11px] text-muted-foreground/50 hidden sm:inline">
                                  Suggestion: {finding.suggestion}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
                          <button
                            className="p-1.5 rounded-md hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500 transition-colors"
                            title={getCleanupRecommendation(finding)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className="p-1.5 rounded-md hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 transition-colors"
                            title="View file"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {stats.high > 0 && (
        <Card className="glass border border-red-500/10">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-500" />
              Cleanup Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {findings
                .filter((f) => f.confidence === "HIGH")
                .slice(0, 5)
                .map((finding, idx) => (
                  <div key={`rec-${idx}`} className="flex items-start gap-2 text-sm">
                    <Merge className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span>
                      <code className="text-xs font-mono bg-white/5 px-1 py-0.5 rounded">
                        {finding.filePath.split("/").pop()}:{finding.exportLine}
                      </code>
                      {" "}
                      <span className="text-muted-foreground">
                        {getCleanupRecommendation(finding)}
                      </span>
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
