"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  GitBranch,
  Star,
  GitFork,
  Eye,
  Clock,
  Users,
  Code,
  FileText,
  Activity,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  EmptyState,
  Input,
} from "@/components/ui";
import { BeginnerModeToggle } from "@/components/repository/BeginnerModeToggle";
import { BeginnerGuidanceCard } from "@/components/repository/BeginnerGuidanceCard";
import { BeginnerQuestionsPanel } from "@/components/repository/BeginnerQuestionsPanel";
import { FirstPRSimulator } from "@/components/repository/FirstPRSimulator";
import { ContributionPathGenerator } from "@/components/repository/ContributionPathGenerator";
import { DeadCodeDetector } from "@/components/repository/DeadCodeDetector";
import { ArchitecturalDriftDetector } from "@/components/repository/ArchitecturalDriftDetector";
import { QuickStartChecklist } from "@/components/repository/QuickStartChecklist";
import { FolderImportanceGuide } from "@/components/repository/FolderImportanceGuide";
import { SavedModulesPanel } from "@/components/repository/SavedModulesPanel";
import { ModuleComparisonTool } from "@/components/repository/ModuleComparisonTool";
import { GoodFirstIssueGenerator } from "@/components/repository/GoodFirstIssueGenerator";
import { DuplicateFeatureDetector } from "@/components/repository/DuplicateFeatureDetector";
import { HotspotForecasting } from "@/components/repository/HotspotForecasting";
import { RepositoryInsightsDashboard } from "@/components/repository/RepositoryInsightsDashboard";
import { useModuleBookmarks } from "@/hooks/useModuleBookmarks";
import { IssueData } from "@/types/firstPRSimulator";
import { RepositoryAnalysisData } from "@/types/contributionPath";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

interface RepositoryData {
  id: string;
  name: string;
  fullName: string;
  url: string;
  description: string;
  stars: number;
  forks: number;
  watchers: number;
  language: string;
  createdAt: string;
  updatedAt: string;
  size: number;
  defaultBranch: string;
  openIssues: number;
  license?: string;
}

interface RepositoryOverviewProps {
  repositoryData?: any;
}

export const RepositoryOverview = ({
  repositoryData,
}: RepositoryOverviewProps) => {
  // IMPORTANT: derive README directly from props so it always matches the
  // currently-selected repository (avoids showing stale README when navigating).
  const readmeText: string | null = repositoryData?.readmeText ?? null;
  const readmePath: string | null = repositoryData?.readmePath ?? null;

  // Initialize module bookmarks hook
  const { bookmarkedModules, removeBookmark } = useModuleBookmarks();

  // Calculate total lines of code from languages only
  const totalLines =
    repositoryData?.languages?.reduce(
      (sum: number, lang: any) => sum + (lang.lines || 0),
      0,
    ) || 0;

  // Use real repository data
  const repository: RepositoryData = {
    id: repositoryData?.id?.toString() || "0",
    name: repositoryData?.name || "Unknown",
    fullName: repositoryData?.fullName || repositoryData?.name || "Unknown",
    url: repositoryData?.url || "#",
    description: repositoryData?.description || "No description available",
    stars: repositoryData?.stars || 0,
    forks: repositoryData?.forks || 0,
    watchers: repositoryData?.watchers || 0,
    language:
      repositoryData?.languages?.[0]?.name ||
      repositoryData?.primaryLanguage ||
      "Unknown",
    createdAt: repositoryData?.createdAt || new Date().toISOString(),
    updatedAt: repositoryData?.analyzedAt
      ? new Date(repositoryData.analyzedAt).toLocaleString()
      : "Unknown",
    size: repositoryData?.size || 0,
    defaultBranch: repositoryData?.defaultBranch || "main",
    openIssues: repositoryData?.openIssues || 0,
    license: repositoryData?.license || undefined,
  };

  const [isBeginnerMode, setIsBeginnerMode] = useState(false);
  const [issueTitle, setIssueTitle] = useState("");
  const [issueBody, setIssueBody] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<IssueData | null>(null);

  const sampleIssue = useMemo(() => {
    if (!repositoryData?.issues?.length) return null;
    const issue = repositoryData.issues[0];
    return {
      id: issue.id?.toString?.() || "sample-issue",
      title: issue.title || "",
      body: issue.body || issue.description || "",
      labels: issue.labels || [],
    } as IssueData;
  }, [repositoryData?.issues]);

  const issueToSimulate = selectedIssue || sampleIssue;

  const repositoryMetadata = useMemo<RepositoryAnalysisData>(() => ({
    id: repositoryData?.id,
    name: repositoryData?.name,
    description: repositoryData?.description,
    url: repositoryData?.url,
    size: repositoryData?.size,
    files: repositoryData?.files,
    languages: repositoryData?.languages,
    commits: repositoryData?.commits,
    contributors: repositoryData?.contributors,
    issues: repositoryData?.issues,
  }), [repositoryData]);

  const hasIssueInput = Boolean(issueTitle.trim() || issueBody.trim());

  const buildManualIssue = (): IssueData | null => {
    if (!issueTitle.trim() && !issueBody.trim()) return null;
    return {
      id: "manual-issue",
      title: issueTitle.trim() || "First PR issue",
      body: issueBody.trim() || "",
      labels: [],
    };
  };

  const handleRunSimulation = () => {
    const issue = buildManualIssue();
    if (issue) {
      setSelectedIssue(issue);
    }
  };

  const handleResetSimulation = () => {
    setIssueTitle("");
    setIssueBody("");
    setSelectedIssue(null);
  };

  const MODULE_GUIDANCE: Record<
    string,
    {
      description: string;
      recommendation: string;
      difficulty: "beginner" | "intermediate" | "advanced";
    }
  > = {
    components: {
      description:
        "Contains reusable UI building blocks used throughout the application.",
      recommendation: "Recommended starting point for frontend contributors.",
      difficulty: "beginner",
    },
    services: {
      description: "Handles business logic and API communication.",
      recommendation: "Changes here may affect multiple features.",
      difficulty: "intermediate",
    },
    hooks: {
      description: "Reusable React logic shared across components.",
      recommendation: "Good place to learn application behavior.",
      difficulty: "beginner",
    },
    utils: {
      description: "Shared helper functions and utilities.",
      recommendation: "Usually safe for small contributions.",
      difficulty: "beginner",
    },
    pages: {
      description: "Application routes and screens.",
      recommendation: "Useful for understanding navigation flow.",
      difficulty: "intermediate",
    },
    auth: {
      description: "Authentication and access control.",
      recommendation: "Requires understanding of security flows.",
      difficulty: "advanced",
    },
  };

  const ARCHITECTURE_GUIDANCE: Record<string, string> = {
    services:
      "Service layer responsible for API communication and business logic.",
    hooks: "Custom React logic reused across multiple components.",
    components: "Reusable visual building blocks used throughout the application.",
    utils: "Utility helpers that keep the app consistent and reusable.",
    pages: "Route and screen organization that controls navigation flow.",
    auth: "Authentication logic that secures access and identity flows.",
  };

  const moduleFolders = useMemo(() => {
    const segments = new Set<string>();

    (repositoryData?.files || []).forEach((file: any) => {
      const parts = String(file.path || "").split("/").filter(Boolean);
      parts.slice(0, -1).forEach((segment) => {
        if (segment) {
          segments.add(segment);
        }
      });
    });

    return Array.from(segments).filter((segment) =>
      Object.prototype.hasOwnProperty.call(MODULE_GUIDANCE, segment),
    );
  }, [repositoryData?.files]);

  const hotspotGuidance = useMemo(() => {
    const filePaths = (repositoryData?.files || []).map((file: any) =>
      String(file.path || "").toLowerCase(),
    );

    return [
      {
        title: "Authentication",
        hint: "Changes here may affect login and security-related features.",
        active:
          moduleFolders.includes("auth") ||
          filePaths.some((path: string) => path.includes("/auth/")),
      },
      {
        title: "Services",
        hint: "Modifications may impact multiple application workflows.",
        active: moduleFolders.includes("services"),
      },
      {
        title: "State Management",
        hint: "Shared application state can affect many screens.",
        active: filePaths.some((path: string) =>
          ["store", "state", "redux", "context"].some((keyword) =>
            path.includes(keyword),
          ),
        ),
      },
    ].filter((item) => item.active);
  }, [repositoryData?.files, moduleFolders]);

  const stats = [
    {
      label: "Total Commits",
      value: repositoryData?.commits?.length?.toString() || "0",
      icon: Activity,
      trend: `Default: ${repositoryData?.defaultBranch || "main"}`,
    },
    {
      label: "Contributors",
      value: repositoryData?.contributors?.length?.toString() || "0",
      icon: Users,
      trend: `${repositoryData?.contributors?.filter((c: any) => c.commits > 0)?.length || 0} active`,
    },
    {
      label: "Lines of Code",
      value:
        totalLines > 1000000
          ? `${(totalLines / 1000000).toFixed(1)}M`
          : totalLines > 1000
            ? `${(totalLines / 1000).toFixed(1)}K`
            : totalLines.toString(),
      icon: Code,
      trend: `${repositoryData?.languages?.length || 0} languages`,
    },
    {
      label: "Files",
      value: repositoryData?.files?.length?.toString() || "0",
      icon: FileText,
      trend: `${(repositoryData?.size || 0) / 1024 < 1 ? "<1" : ((repositoryData?.size || 0) / 1024).toFixed(0)} KB`,
    },
  ];

  const getLanguageColor = (name: string) => {
    const colors: Record<string, string> = {
      TypeScript: "bg-blue-500",
      JavaScript: "bg-yellow-500",
      Python: "bg-green-500",
      Java: "bg-red-500",
      CSS: "bg-purple-500",
      HTML: "bg-orange-500",
      Go: "bg-cyan-500",
      Rust: "bg-orange-600",
      Ruby: "bg-red-600",
    };
    return colors[name] || "bg-gray-500";
  };

  const languages = (repositoryData?.languages || []).map((lang: any) => ({
    name: lang.name,
    percentage: lang.percentage,
    color: getLanguageColor(lang.name),
  }));

  const hasUsableReadme = Boolean(readmeText && readmeText !== "doesnt exist");

  const githubRawBase = (() => {
    const url = String(repositoryData?.url || "");
    const m = url.match(
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?\/?$/i,
    );
    if (!m) return null;
    const owner = m[1];
    const repo = m[2];
    const branch = String(repositoryData?.defaultBranch || "main");
    return `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/`;
  })();

  const githubBlobBase = (() => {
    const url = String(repositoryData?.url || "");
    const m = url.match(
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?\/?$/i,
    );
    if (!m) return null;
    const owner = m[1];
    const repo = m[2];
    const branch = String(repositoryData?.defaultBranch || "main");
    return `https://github.com/${owner}/${repo}/blob/${encodeURIComponent(branch)}/`;
  })();

  const resolveRepoRelativeUrl = (raw: string, kind: "image" | "link") => {
    if (!raw) return raw;
    const v = raw.trim();
    if (
      v.startsWith("http://") ||
      v.startsWith("https://") ||
      v.startsWith("data:") ||
      v.startsWith("mailto:") ||
      v.startsWith("#")
    ) {
      return v;
    }

    const base = kind === "image" ? githubRawBase : githubBlobBase;
    if (!base) return v;

    // Handle absolute-from-repo-root paths like "/assets/logo.png".
    const pathPart = v.startsWith("/") ? v.slice(1) : v;
    return `${base}${pathPart}`;
  };

  const readmeSanitizeSchema = (() => {
    // Allow common README HTML (like <img align="right" ...>) while keeping things safe.
    const schema: any = {
      ...(defaultSchema as any),
      tagNames: Array.from(
        new Set([...(defaultSchema as any).tagNames, "img"]),
      ),
      attributes: {
        ...((defaultSchema as any).attributes || {}),
        a: Array.from(
          new Set([
            ...(((defaultSchema as any).attributes?.a as any[]) || []),
            "target",
            "rel",
          ]),
        ),
        img: ["src", "alt", "title", "width", "height", "align", "loading"],
      },
    };

    return schema;
  })();

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60),
    );

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return "Yesterday";
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  const recentActivity = (repositoryData?.commits || [])
    .slice(0, 4)
    .map((commit: any) => ({
      type: "commit",
      user: commit.authorName || "Unknown",
      message: commit.message || "No message",
      time: formatTimeAgo(commit.committedAt || commit.createdAt),
    }));

  return (
    <div className="space-y-6">
      {/* Repository Header */}
      <div className="glass rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2 flex-wrap">
              <GitBranch className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
              <h1 className="text-2xl sm:text-3xl font-heading font-bold truncate">
                {repository.name}
              </h1>
              <span className="px-2 py-1 rounded-full text-xs bg-accent/10 text-accent flex-shrink-0">
                {repository.language}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mb-3 break-words">
              {repository.description}
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground flex-wrap">
              <a
                href={repository.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-primary transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                {repository.fullName}
              </a>
              {repository.license && (
                <span className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {repository.license}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Updated {repository.updatedAt}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-lg sm:text-xl font-bold">
                {repository.stars}
              </div>
              <div className="text-xs text-muted-foreground">Stars</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GitFork className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-lg sm:text-xl font-bold">
                {repository.forks}
              </div>
              <div className="text-xs text-muted-foreground">Forks</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 sm:h-5 sm:w-5 text-accent flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-lg sm:text-xl font-bold">
                {repository.watchers}
              </div>
              <div className="text-xs text-muted-foreground">Watchers</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-destructive flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-lg sm:text-xl font-bold">
                {repository.openIssues}
              </div>
              <div className="text-xs text-muted-foreground">Issues</div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 transition-all duration-300">
        <Card className="glass border border-border/60 p-4">
          <CardHeader>
            <CardTitle>First PR Simulator</CardTitle>
            <CardDescription>
              Generate a recommended first PR plan from a repository issue or a custom issue description.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_1.5fr]">
              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground">Issue title</label>
                <Input
                  value={issueTitle}
                  onChange={(event) => setIssueTitle(event.target.value)}
                  placeholder="e.g. Fix broken repository filtering"
                />
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground">Issue description</label>
                <textarea
                  value={issueBody}
                  onChange={(event) => setIssueBody(event.target.value)}
                  className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Describe the issue and expected behavior..."
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleRunSimulation}
                  disabled={!hasIssueInput}
                >
                  Simulate issue
                </Button>
                {sampleIssue && (
                  <Button
                    variant="secondary"
                    onClick={() => setSelectedIssue(sampleIssue)}
                  >
                    Use first available issue
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={handleResetSimulation}
                >
                  Reset
                </Button>
              </div>
              <p className="text-xs text-muted-foreground max-w-xl">
                The simulator uses issue text and repository structure to recommend a starter file set, difficulty, and test focus.
              </p>
            </div>
          </CardContent>
        </Card>

        <FirstPRSimulator issue={issueToSimulate} repository={repositoryMetadata} />

        <ContributionPathGenerator repository={repositoryMetadata} />

        <DeadCodeDetector repository={repositoryMetadata} />

        <ArchitecturalDriftDetector repository={repositoryMetadata} />

        <BeginnerModeToggle
          enabled={isBeginnerMode}
          onToggle={() => setIsBeginnerMode(!isBeginnerMode)}
        />

        {isBeginnerMode && (
          <div className="grid gap-4 lg:grid-cols-[1.75fr_minmax(260px,1fr)]">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {moduleFolders.length > 0 ? (
                  moduleFolders.map((folder) => (
                    <BeginnerGuidanceCard
                      key={folder}
                      moduleName={folder}
                      guidance={MODULE_GUIDANCE[folder]}
                      architectureDescription={
                        ARCHITECTURE_GUIDANCE[folder] ||
                        "A common architecture concept for this module."
                      }
                    />
                  ))
                ) : (
                  <Card className="glass border border-border/60 p-4">
                    <CardDescription className="text-sm text-muted-foreground">
                      No labeled modules detected for Beginner Mode guidance.
                    </CardDescription>
                  </Card>
                )}
              </div>

              {hotspotGuidance.length > 0 && (
                <Card className="glass border border-border/60">
                  <CardHeader>
                    <CardTitle className="text-base">Hotspot Guidance</CardTitle>
                    <CardDescription>
                      Contextual warnings for areas that may require extra care.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {hotspotGuidance.map((hotspot) => (
                      <div
                        key={hotspot.title}
                        className="rounded-2xl border border-amber-200/60 bg-amber-100/10 p-4"
                      >
                        <div className="flex items-center gap-2 text-amber-700">
                          <AlertTriangle className="h-4 w-4" />
                          <p className="font-semibold">{hotspot.title}</p>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {hotspot.hint}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            <BeginnerQuestionsPanel />
          </div>
        )}

        <QuickStartChecklist />

        <SavedModulesPanel
          bookmarkedModules={bookmarkedModules}
          onRemoveBookmark={removeBookmark}
        />

        <RepositoryInsightsDashboard repositoryData={repositoryData} />

        <GoodFirstIssueGenerator repository={repositoryMetadata} />

        <DuplicateFeatureDetector repository={repositoryMetadata} />

        <HotspotForecasting 
          forecast={{
            id: `repo-forecast-${repositoryData?.id}`,
            repositoryId: repositoryData?.id || "",
            generatedAt: new Date(),
            forecastWindow: 90,
            repositoryHealthScore: 72,
            projectedHealthScore: 64,
            healthTrend: "DEGRADING",
            modulesAtRisk: 6,
            criticalModules: 2,
            highRiskModules: 4,
            technicalDebtTrend: "INCREASING",
            averageComplexityGrowth: 8.5,
            averageDependencyGrowth: 6.2,
            averageChurn: 4.8,
            hotspotForecasts: [],
            topRecommendations: [],
            riskDistribution: { critical: 2, high: 4, medium: 7, low: 5 }
          }}
        />

        <ModuleComparisonTool />

        <FolderImportanceGuide />
      </div>

      {/* Repository Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat, index) => (
          <Card
            key={stat.label}
            className="glass glass-hover"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">
                    {stat.label}
                  </p>
                  <p className="text-2xl sm:text-3xl font-heading font-bold">
                    {stat.value}
                  </p>
                  <p className="text-xs text-accent mt-1 flex items-center gap-1 truncate">
                    <TrendingUp className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{stat.trend}</span>
                  </p>
                </div>
                <div className="p-2 sm:p-3 rounded-lg bg-primary/10 flex-shrink-0">
                  <stat.icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Language Breakdown */}
        <Card className="lg:col-span-2 glass">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="font-heading text-lg sm:text-xl">
              Language Breakdown
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Code distribution by programming language
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0 sm:pt-0">
            {languages.length > 0 ? (
              languages.map((lang: any) => (
                <div key={lang.name}>
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <span className="text-xs sm:text-sm font-medium truncate">
                      {lang.name}
                    </span>
                    <span className="text-xs sm:text-sm text-muted-foreground flex-shrink-0">
                      {lang.percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`${lang.color} h-2 rounded-full transition-all`}
                      style={{ width: `${lang.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={Code}
                title="No language data"
                description="We couldn't detect any programming languages."
              />
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="glass">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="font-heading text-lg sm:text-xl">
              Recent Activity
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Latest updates
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            {recentActivity.length > 0 ? (
              <div className="space-y-3 sm:space-y-4">
                {recentActivity.map((activity: any, index: number) => (
                  <div key={index} className="flex items-start gap-2 sm:gap-3">
                    <div className="mt-1 p-1.5 rounded-full bg-accent/10 flex-shrink-0">
                      <Activity className="h-3 w-3 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm">
                        <span className="font-medium">{activity.user}</span>{" "}
                        <span className="text-muted-foreground break-words">
                          {activity.message}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Activity}
                title="No activity history"
                description="No recent commits recorded."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* README */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        <Card className="glass">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="font-heading text-lg sm:text-xl">
              README
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {readmePath ? `Showing ${readmePath}` : "README"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-3">
            {hasUsableReadme ? (
              <div className="bg-background/50 border border-border/50 rounded-lg p-3 max-h-96 overflow-auto text-sm leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[
                    rehypeRaw,
                    [rehypeSanitize, readmeSanitizeSchema],
                  ]}
                  components={{
                    h1: (props) => (
                      <h1
                        className="text-xl sm:text-2xl font-bold mt-2 mb-3"
                        {...props}
                      />
                    ),
                    h2: (props) => (
                      <h2
                        className="text-lg sm:text-xl font-semibold mt-5 mb-2"
                        {...props}
                      />
                    ),
                    h3: (props) => (
                      <h3
                        className="text-base sm:text-lg font-semibold mt-4 mb-2"
                        {...props}
                      />
                    ),
                    p: (props) => (
                      <p className="my-2 text-sm leading-relaxed" {...props} />
                    ),
                    a: ({ href, children, ...props }) => (
                      <a
                        href={resolveRepoRelativeUrl(
                          String(href || ""),
                          "link",
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2"
                        {...props}
                      >
                        {children}
                      </a>
                    ),
                    img: ({ src, alt, title, ...props }) => {
                      const resolved = resolveRepoRelativeUrl(
                        String(src || ""),
                        "image",
                      );
                      const align = (props as any)?.align as
                        | "left"
                        | "right"
                        | "center"
                        | undefined;

                      const floatClass =
                        align === "right"
                          ? "float-right ml-4"
                          : align === "left"
                            ? "float-left mr-4"
                            : "";

                      return (
                        <img
                          src={resolved}
                          alt={alt || ""}
                          title={title}
                          loading="lazy"
                          className={`max-w-full h-auto rounded-md my-3 ${floatClass}`}
                          {...props}
                        />
                      );
                    },
                    code: ({ className, children, ...props }) => {
                      const isBlock = Boolean(className);
                      if (!isBlock) {
                        return (
                          <code
                            className="px-1 py-0.5 rounded bg-black/30 text-xs"
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      }

                      return (
                        <code
                          className={`block whitespace-pre-wrap text-xs leading-relaxed ${className || ""}`}
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    },
                    pre: (props) => (
                      <pre
                        className="my-3 p-3 rounded-lg bg-black/30 overflow-auto"
                        {...props}
                      />
                    ),
                    ul: (props) => (
                      <ul
                        className="list-disc pl-6 my-2 space-y-1"
                        {...props}
                      />
                    ),
                    ol: (props) => (
                      <ol
                        className="list-decimal pl-6 my-2 space-y-1"
                        {...props}
                      />
                    ),
                    li: (props) => <li className="text-sm" {...props} />,
                    hr: (props) => (
                      <hr className="my-4 border-border/50" {...props} />
                    ),
                    blockquote: (props) => (
                      <blockquote
                        className="border-l-2 border-border/60 pl-3 my-3 text-muted-foreground"
                        {...props}
                      />
                    ),
                    table: (props) => (
                      <div className="my-3 overflow-auto">
                        <table
                          className="min-w-full text-sm border border-border/50"
                          {...props}
                        />
                      </div>
                    ),
                    th: (props) => (
                      <th
                        className="text-left font-semibold p-2 border-b border-border/50 bg-black/20"
                        {...props}
                      />
                    ),
                    td: (props) => (
                      <td
                        className="p-2 border-b border-border/30"
                        {...props}
                      />
                    ),
                  }}
                >
                  {readmeText || ""}
                </ReactMarkdown>
                <div className="clear-both" />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No README found for this repository.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
