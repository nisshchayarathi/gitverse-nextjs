"use client";

import { useMemo, useState } from "react";
import {
  Copy,
  AlertCircle,
  TrendingUp,
  Zap,
  Code2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  FileCode,
  Filter,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  EmptyState,
  Button,
  LoadingSpinner,
  Badge,
} from "@/components/ui";
import { analyzeDuplicateFeatures, getDuplicateStats } from "@/services/duplicateFeatureDetectorService";
import { RepositoryAnalysisData } from "@/types/contributionPath";
import { RepositoryFile } from "@/types/firstPRSimulator";
import { DuplicateCluster, RefactorRecommendation } from "@/types/duplicateFeature";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface DuplicateFeatureDetectorProps {
  repository?: RepositoryAnalysisData | null;
  loading?: boolean;
}

const severityConfig = {
  high: {
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-900/10",
    icon: <AlertTriangle className="w-4 h-4" />,
    label: "Critical",
  },
  medium: {
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 dark:bg-yellow-900/10",
    icon: <AlertCircle className="w-4 h-4" />,
    label: "Moderate",
  },
  low: {
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-900/10",
    icon: <Code2 className="w-4 h-4" />,
    label: "Minor",
  },
};

const riskConfig = {
  low: { color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-900/10" },
  medium: { color: "text-yellow-600", bgColor: "bg-yellow-50 dark:bg-yellow-900/10" },
  high: { color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-900/10" },
};

const DuplicateClusterCard = ({
  cluster,
  recommendation,
  onExpand,
}: {
  cluster: DuplicateCluster;
  recommendation?: RefactorRecommendation;
  onExpand: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const severity = severityConfig[cluster.severity];

  return (
    <Card className="glass hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={`${severity.bgColor} ${severity.color} border-0`}>
                <span className="mr-1">{severity.icon}</span>
                {severity.label}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {cluster.averageSimilarity}% match
              </Badge>
            </div>
            <CardTitle className="text-base leading-tight">{cluster.featureName}</CardTitle>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 p-1 hover:bg-secondary rounded transition-colors"
          >
            {expanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        <p className="text-sm text-muted-foreground mb-4">{cluster.description}</p>

        <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
          <div className="bg-secondary/50 rounded p-2">
            <div className="text-muted-foreground">Instances</div>
            <div className="font-semibold">{cluster.instances.length}</div>
          </div>
          <div className="bg-secondary/50 rounded p-2">
            <div className="text-muted-foreground">Lines</div>
            <div className="font-semibold">{cluster.totalLines}</div>
          </div>
          <div className="bg-secondary/50 rounded p-2">
            <div className="text-muted-foreground">Confidence</div>
            <div className="font-semibold">{cluster.confidence}%</div>
          </div>
          <div className="bg-secondary/50 rounded p-2">
            <div className="text-muted-foreground">Potential Savings</div>
            <div className="font-semibold">{cluster.potentialSavings} lines</div>
          </div>
        </div>

        {cluster.instances.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-muted-foreground mb-2">Affected Files:</div>
            <div className="flex flex-wrap gap-1">
              {cluster.instances.slice(0, 3).map((inst, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  <FileCode className="w-3 h-3 mr-1" />
                  {inst.fileName}
                </Badge>
              ))}
              {cluster.instances.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{cluster.instances.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {expanded && (
          <div className="border-t pt-4 space-y-4">
            <div>
              <h4 className="text-xs font-semibold mb-2">Duplicated Logic Type:</h4>
              <p className="text-xs text-muted-foreground capitalize">{cluster.featureType}</p>
            </div>

            {recommendation && (
              <div>
                <h4 className="text-xs font-semibold mb-2">Refactor Recommendation:</h4>
                <div className="bg-secondary/30 rounded p-3 space-y-2 text-xs">
                  <p className="font-medium">{recommendation.title}</p>
                  <p className="text-muted-foreground">{recommendation.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge
                      className={`${riskConfig[recommendation.riskLevel].bgColor} ${riskConfig[recommendation.riskLevel].color}`}
                    >
                      Risk: {recommendation.riskLevel}
                    </Badge>
                    <Badge variant="outline">Est. {recommendation.estimatedHours}h</Badge>
                    <Badge variant="outline">Impact: {recommendation.affectedFiles.length} files</Badge>
                  </div>
                </div>
              </div>
            )}

            {recommendation?.implementationSteps && (
              <div>
                <h4 className="text-xs font-semibold mb-2">Implementation Steps:</h4>
                <ol className="text-xs space-y-1 list-decimal list-inside">
                  {recommendation.implementationSteps.map((step, idx) => (
                    <li key={idx} className="text-muted-foreground">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {recommendation?.expectedBenefits && (
              <div>
                <h4 className="text-xs font-semibold mb-2">Expected Benefits:</h4>
                <ul className="text-xs space-y-1">
                  {recommendation.expectedBenefits.slice(0, 3).map((benefit, idx) => (
                    <li key={idx} className="flex gap-2">
                      <CheckCircle2 className="w-3 h-3 mt-0.5 text-green-600 flex-shrink-0" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="border-t py-3">
        <Button size="sm" variant="outline" className="w-full">
          <Copy className="w-4 h-4 mr-1" />
          Copy Details
        </Button>
      </CardFooter>
    </Card>
  );
};

export function DuplicateFeatureDetector({
  repository,
  loading = false,
}: DuplicateFeatureDetectorProps) {
  const files = (repository?.files || []) as RepositoryFile[];
  const [selectedSeverity, setSelectedSeverity] = useState<"all" | "high" | "medium" | "low">("all");

  const analysis = useMemo(() => {
    if (!repository || !files.length) return null;
    return analyzeDuplicateFeatures(repository as any);
  }, [repository, files]);

  const stats = useMemo(() => {
    if (!repository || !files.length) return null;
    return getDuplicateStats(repository as any);
  }, [repository, files]);

  const filteredClusters = useMemo(() => {
    if (!analysis) return [];
    if (selectedSeverity === "all") return analysis.clusters;
    return analysis.clusters.filter((c) => c.severity === selectedSeverity);
  }, [analysis, selectedSeverity]);

  if (loading) {
    return (
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Copy className="w-5 h-5" />
            <CardTitle>Duplicate Feature Detector</CardTitle>
          </div>
          <CardDescription>Analyzing repository for duplicated code and logic patterns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner message="Scanning for code duplicates…" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!repository || !files.length) {
    return (
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Copy className="w-5 h-5" />
            <CardTitle>Duplicate Feature Detector</CardTitle>
          </div>
          <CardDescription>Identify duplicated code and refactoring opportunities</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<Code2 className="w-12 h-12" />}
            title="No Repository Data"
            description="Complete a repository analysis to detect duplicates"
          />
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.totalDuplicates === 0) {
    return (
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Copy className="w-5 h-5" />
            <CardTitle>Duplicate Feature Detector</CardTitle>
          </div>
          <CardDescription>Identify duplicated code and refactoring opportunities</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<CheckCircle2 className="w-12 h-12" />}
            title="No Duplicates Detected"
            description="Great code hygiene! No significant duplicates found in this repository."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Copy className="w-5 h-5" />
              <div>
                <CardTitle>Duplicate Feature Detector</CardTitle>
                <CardDescription>
                  Identify duplicated code and refactoring opportunities
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {stats.potentialImprovements.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex gap-3">
              <TrendingUp className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900 dark:text-amber-100 flex-1">
                <p className="font-semibold mb-1">Refactoring Opportunities</p>
                <ul className="text-xs space-y-1">
                  {stats.potentialImprovements.slice(0, 3).map((opp, idx) => (
                    <li key={idx}>• {opp}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="grid grid-cols-5 gap-2">
            <Button
              variant={selectedSeverity === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedSeverity("all")}
              className="justify-center"
            >
              <span className="text-xs">All ({stats.totalDuplicates})</span>
            </Button>
            <Button
              variant={selectedSeverity === "high" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedSeverity("high")}
              className="justify-center text-red-600 dark:text-red-400"
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              <span className="text-xs">Critical ({stats.criticalDuplicates})</span>
            </Button>
            <Button
              variant={selectedSeverity === "medium" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedSeverity("medium")}
              className="justify-center text-yellow-600 dark:text-yellow-400"
            >
              <AlertCircle className="w-3 h-3 mr-1" />
              <span className="text-xs">Moderate ({stats.moderateDuplicates})</span>
            </Button>
            <Button
              variant={selectedSeverity === "low" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedSeverity("low")}
              className="justify-center text-blue-600 dark:text-blue-400"
            >
              <Code2 className="w-3 h-3 mr-1" />
              <span className="text-xs">Minor ({stats.minorDuplicates})</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-center"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {analysis && filteredClusters.length > 0 ? (
        <div className="grid gap-4">
          {filteredClusters.map((cluster) => (
            <DuplicateClusterCard
              key={cluster.id}
              cluster={cluster}
              recommendation={analysis.recommendations.find((r) => r.clusterId === cluster.id)}
              onExpand={() => {}}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Filter className="w-12 h-12" />}
          title="No Duplicates in This Category"
          description="Try selecting a different severity level"
        />
      )}
    </div>
  );
}
