"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from "@/components/ui";
import { Shield, ShieldAlert, ShieldX, AlertTriangle, ExternalLink, Search } from "lucide-react";

interface SecurityAdvisory {
  id: string;
  cveId: string;
  summary: string;
  severity: string;
  packageName: string;
  vulnerableVersionRange: string;
  patchedVersion: string;
}

interface DependencyRisk {
  packageName: string;
  currentVersion: string;
  scope: "production" | "development";
  riskScore: number;
  riskLevel: string;
  hasCVE: boolean;
  cveDetails: SecurityAdvisory | null;
  isOutdated: boolean;
  suggestedUpgrade: string | null;
  deprecationStatus: string;
  transitiveCount: number;
}

interface RiskReport {
  overallScore: number;
  overallRiskLevel: string;
  totalDependencies: number;
  vulnerableCount: number;
  outdatedCount: number;
  dependencies: DependencyRisk[];
  scannedAt: string;
  repository: {
    id: number;
    name: string;
    fullName: string;
    lockFilesFound: string[];
  };
}

function RiskBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const color = score >= 70 ? "bg-red-100 text-red-800 border-red-300" :
    score >= 50 ? "bg-orange-100 text-orange-800 border-orange-300" :
    score >= 30 ? "bg-yellow-100 text-yellow-800 border-yellow-300" :
    score >= 10 ? "bg-blue-100 text-blue-800 border-blue-300" :
    "bg-green-100 text-green-800 border-green-300";

  const label = score >= 70 ? "Critical" : score >= 50 ? "High" : score >= 30 ? "Medium" : score >= 10 ? "Low" : "Safe";

  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : size === "lg" ? "text-base px-4 py-1.5" : "text-sm px-3 py-1";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${color} ${sizeClass}`}>
      {score >= 70 ? <ShieldX className="w-3.5 h-3.5" /> : score >= 30 ? <ShieldAlert className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
      {label} ({score})
    </span>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    low: "bg-blue-500",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[severity] || "bg-gray-400"}`} />;
}

interface DependencyRiskPanelProps {
  repositoryId: number;
  className?: string;
}

export default function DependencyRiskPanel({ repositoryId, className = "" }: DependencyRiskPanelProps) {
  const [report, setReport] = useState<RiskReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<"all" | "production" | "development">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPkg, setExpandedPkg] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/repositories/${repositoryId}/dependency-risk`);
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error || "Failed to fetch dependency risk");
        }
        const data = await response.json();
        setReport(data);
      } catch (err: any) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [repositoryId]);

  const filteredDeps = useMemo(() => {
    if (!report) return [];
    let deps = report.dependencies;
    if (scopeFilter !== "all") {
      deps = deps.filter((d) => d.scope === scopeFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      deps = deps.filter((d) => d.packageName.toLowerCase().includes(q));
    }
    return deps;
  }, [report, scopeFilter, searchQuery]);

  const riskDistribution = useMemo(() => {
    const dependencies = report?.dependencies ?? [];
    const dist: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, none: 0 };
    for (const d of dependencies) {
      dist[d.riskLevel] = (dist[d.riskLevel] || 0) + 1;
    }
    return dist;
  }, [report]);

  if (loading) {
    return (
      <Card className={`glass border border-border/70 ${className}`}>
        <CardHeader>
          <CardTitle className="text-base">Dependency Risk Analysis</CardTitle>
          <CardDescription>Scanning dependencies for vulnerabilities...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-32 bg-gray-200 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`glass border border-border/70 ${className}`}>
        <CardHeader>
          <CardTitle className="text-base">Dependency Risk Analysis</CardTitle>
          <CardDescription>Unable to scan dependencies</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-red-600 text-sm">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!report) return null;

  const { overallScore, overallRiskLevel, totalDependencies, vulnerableCount, outdatedCount } = report;

  return (
    <Card className={`glass border border-border/70 ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Dependency Risk Analysis</CardTitle>
            <CardDescription>
              {totalDependencies > 0
                ? `${totalDependencies} dependencies · ${vulnerableCount} vulnerable · ${outdatedCount} outdated`
                : "No lock files found for this repository"}
            </CardDescription>
          </div>
          {totalDependencies > 0 && <RiskBadge score={overallScore} size="lg" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {totalDependencies === 0 ? (
          <div className="text-sm text-gray-500 text-center py-8">
            No package.json or lock files detected. Add one to enable dependency risk scanning.
          </div>
        ) : (
          <>
            {/* Risk distribution treemap */}
            <div className="flex h-8 rounded-lg overflow-hidden">
              {Object.entries(riskDistribution).map(([level, count]) => {
                const pct = totalDependencies > 0 ? (count / totalDependencies) * 100 : 0;
                if (pct === 0) return null;
                const colors: Record<string, string> = {
                  critical: "bg-red-500",
                  high: "bg-orange-500",
                  medium: "bg-yellow-500",
                  low: "bg-blue-400",
                  none: "bg-green-500",
                };
                return (
                  <div
                    key={level}
                    className={`${colors[level]} flex items-center justify-center text-xs text-white font-medium transition-all hover:opacity-90`}
                    style={{ width: `${pct}%`, minWidth: count > 0 ? "fit-content" : undefined }}
                    title={`${level}: ${count}`}
                  >
                    {pct > 10 ? `${level} ${count}` : undefined}
                  </div>
                );
              })}
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Total", value: totalDependencies, color: "text-gray-900" },
                { label: "Vulnerable", value: vulnerableCount, color: "text-red-600" },
                { label: "Outdated", value: outdatedCount, color: "text-orange-600" },
                { label: "Score", value: `${overallScore}`, color: "text-blue-600" },
              ].map((stat) => (
                <div key={stat.label} className="text-center p-2 bg-gray-50 rounded-lg">
                  <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search packages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {(["all", "production", "development"] as const).map((scope) => (
                <button
                  key={scope}
                  onClick={() => setScopeFilter(scope)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    scopeFilter === scope
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {scope === "all" ? "All" : scope === "production" ? "Prod" : "Dev"}
                </button>
              ))}
            </div>

            {/* Dependency table */}
            <div className="space-y-1">
              {filteredDeps.map((dep) => (
                <div key={dep.packageName}>
                  <button
                    onClick={() => setExpandedPkg(expandedPkg === dep.packageName ? null : dep.packageName)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg border hover:bg-gray-50 transition-colors text-left"
                  >
                    <div
                      className={`w-1 h-8 rounded-full shrink-0 ${
                        dep.riskLevel === "critical" ? "bg-red-500" :
                        dep.riskLevel === "high" ? "bg-orange-500" :
                        dep.riskLevel === "medium" ? "bg-yellow-500" :
                        dep.riskLevel === "low" ? "bg-blue-400" : "bg-green-500"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{dep.packageName}</div>
                      <div className="text-xs text-gray-500">
                        {dep.currentVersion}{" "}
                        <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${dep.scope === "production" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                          {dep.scope === "production" ? "prod" : "dev"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {dep.hasCVE && <SeverityDot severity={dep.cveDetails!.severity} />}
                      {dep.isOutdated && <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />}
                      <span className="text-sm font-semibold w-8 text-right">{dep.riskScore}</span>
                    </div>
                  </button>
                  {expandedPkg === dep.packageName && (
                    <div className="ml-4 p-3 bg-gray-50 rounded-lg border text-sm space-y-2">
                      {dep.cveDetails && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <SeverityDot severity={dep.cveDetails.severity} />
                            <span className="font-medium">{dep.cveDetails.cveId}</span>
                            <Badge className={`text-xs ${
                              dep.cveDetails.severity === "critical" ? "bg-red-100 text-red-700" :
                              dep.cveDetails.severity === "high" ? "bg-orange-100 text-orange-700" :
                              "bg-yellow-100 text-yellow-700"
                            }`}>
                              {dep.cveDetails.severity}
                            </Badge>
                          </div>
                          <p className="text-gray-600">{dep.cveDetails.summary}</p>
                          <div className="text-xs text-gray-500">
                            Affects: {dep.cveDetails.vulnerableVersionRange} · Patch: {dep.cveDetails.patchedVersion}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                        <div>Transitive deps: {dep.transitiveCount}</div>
                        <div>Status: {dep.deprecationStatus}</div>
                        {dep.suggestedUpgrade && <div>Suggested: {dep.suggestedUpgrade}</div>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {filteredDeps.length === 0 && (
                <div className="text-sm text-gray-500 text-center py-4">No matching dependencies</div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
