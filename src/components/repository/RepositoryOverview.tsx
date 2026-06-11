"use client";

import { useState, useMemo, Children, isValidElement } from "react";
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
  Sparkles,
  Edit2,
  Copy,
  Save,
  Check,
  RefreshCw,
  Loader2,
  Package,
} from "lucide-react";
import Link from "next/link";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  EmptyState,
  Input,
  Skeleton,
  CopyToClipboard,
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
import { RepositoryInsightsDashboard } from "@/components/repository/RepositoryInsightsDashboard";
import { useModuleBookmarks } from "@/hooks/useModuleBookmarks";
import { IssueData } from "@/types/firstPRSimulator";
import { RepositoryAnalysisData } from "@/types/contributionPath";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { ContributorJourneyPanel } from "@/components/repository/ContributorJourneyPanel";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/services/apiConfig";
import axios from "axios";
import { FavoriteButton } from "./FavoriteButton";


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
  const [isFavorited, setIsFavorited] = useState(false);

  const { toast } = useToast();
  const [isReadmeModalOpen, setIsReadmeModalOpen] = useState(false);
  const [isGeneratingReadme, setIsGeneratingReadme] = useState(false);
  const [generatedReadme, setGeneratedReadme] = useState("");
  const [editorText, setEditorText] = useState("");
  const [editorMode, setEditorMode] = useState<"edit" | "preview">("preview");
  const [isSavingReadme, setIsSavingReadme] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const handleGenerateReadme = async () => {
    setIsGeneratingReadme(true);
    setIsReadmeModalOpen(true);
    setEditorMode("preview");
    try {
      const token = localStorage.getItem("gitverse_token");
      const response = await axios.post(
        buildApiUrl("/api/ai/generate-readme"),
        { repositoryId: Number(repository.id) },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const readme = response.data.markdown;
      setGeneratedReadme(readme);
      setEditorText(readme);
    } catch (error: any) {
      console.error("Error generating README:", error);
      toast({
        title: "Generation failed",
        description: error.response?.data?.error || "Failed to generate README using Gemini.",
        variant: "destructive",
      });
      setIsReadmeModalOpen(false);
    } finally {
      setIsGeneratingReadme(false);
    }
  };

  const handleCopyReadme = async () => {
    try {
      await navigator.clipboard.writeText(editorText);
      setHasCopied(true);
      toast({
        title: "Copied",
        description: "Markdown copied to clipboard successfully.",
      });
      setTimeout(() => setHasCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy text to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleSaveReadme = async () => {
    setIsSavingReadme(true);
    try {
      const token = localStorage.getItem("gitverse_token");
      await axios.put(
        buildApiUrl(`/api/repositories/${repository.id}/readme`),
        { readmeText: editorText, readmePath: readmePath || "README.md" },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast({
        title: "README Saved",
        description: "Successfully updated repository README in the database.",
      });

      // Update local view of repositoryData
      if (repositoryData) {
        repositoryData.readmeText = editorText;
        if (!repositoryData.readmePath) {
          repositoryData.readmePath = "README.md";
        }
      }
      setIsReadmeModalOpen(false);
    } catch (error: any) {
      console.error("Error saving README:", error);
      toast({
        title: "Save failed",
        description: error.response?.data?.error || "Failed to save README changes.",
        variant: "destructive",
      });
    } finally {
      setIsSavingReadme(false);
    }
  };

  const handleToggleFavorite = async (id: string, nextState: boolean) => {
    // Simulate server API latency of 1.5 seconds
    await new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate a 30% chance of failure to showcase the try/catch rollback
        if (Math.random() > 0.7) {
          reject(new Error("Database connection lost. Please try again."));
        } else {
          setIsFavorited(nextState);
          resolve(null);
        }
      }, 1500);
    });
  };

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

  const MODULE_GUIDANCE = useMemo<Record<
    string,
    {
      description: string;
      recommendation: string;
      difficulty: "beginner" | "intermediate" | "advanced";
    }
  >>(() => ({
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
  }), []);

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
  }, [repositoryData?.files, MODULE_GUIDANCE]);

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
  const isAnalyzing =
    repositoryData?.status === "pending" ||
    repositoryData?.status === "analyzing";

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
              {repositoryData?.parent && (
                <Link
                  href={`/repo/${repositoryData.parent.id}`}
                  className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary flex items-center gap-1 hover:bg-primary/20 transition-colors flex-shrink-0"
                  title="View Parent Repository"
                >
                  <Package className="h-3 w-3" />
                  Part of {repositoryData.parent.name}
                </Link>
              )}
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
          {/* Favorite Action Button */}
          <div className="flex-shrink-0 self-start sm:self-center">
            <FavoriteButton
              initialIsFavorited={isFavorited}
              repositoryId={repository.id}
              onToggle={handleToggleFavorite}
            />
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

        <ModuleComparisonTool />

        <FolderImportanceGuide />
      </div>

      {/* Monorepo Sub-packages */}
      {repositoryData?.subPackages && repositoryData.subPackages.length > 0 && (
        <Card className="glass border border-primary/20 bg-primary/5">
          <CardHeader className="p-4 sm:p-6 pb-2">
            <CardTitle className="font-heading text-lg sm:text-xl flex items-center gap-2 text-primary">
              <Package className="h-5 w-5" />
              Monorepo Workspaces
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              This repository contains multiple packages. Select one to view its isolated analysis.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {repositoryData.subPackages.map((subPkg: any) => (
                <Link
                  key={subPkg.id}
                  href={`/repo/${subPkg.id}`}
                  className="p-3 rounded-xl border border-border/50 bg-background/50 hover:bg-background/80 hover:border-primary/50 transition-all group flex flex-col gap-1"
                >
                  <div className="font-medium flex items-center justify-between">
                    <span className="truncate">{subPkg.targetDirectory}</span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {subPkg.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
            {languages.map((lang: any) => (
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
            ))}
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
          </CardContent>
        </Card>
      </div>

      {/* Contributor Journey Simulator */}
      <ContributorJourneyPanel repository={repositoryData} />

      {/* README */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        <Card className="glass">
          <CardHeader className="p-4 sm:p-6 flex flex-row items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="font-heading text-lg sm:text-xl">
                README
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {readmePath ? `Showing ${readmePath}` : "README"}
              </CardDescription>
            </div>
            <button
              onClick={handleGenerateReadme}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-semibold shadow-lg shadow-primary/20 transition-all duration-300 transform hover:scale-105"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generate AI README
            </button>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-3">
            {isAnalyzing && !hasUsableReadme ? (
              <div className="bg-background/50 border border-border/50 rounded-lg p-4 space-y-4" aria-busy="true" aria-label="Loading README">
                <Skeleton className="h-8 w-1/3 sm:w-1/4" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
                <div className="pt-4 space-y-2">
                  <Skeleton className="h-6 w-1/4 sm:w-1/5" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-32 w-full mt-4" />
                </div>
              </div>
            ) : hasUsableReadme ? (
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
                        // eslint-disable-next-line @next/next/no-img-element
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
                    pre: ({ children, ...props }) => {
                      let codeText = "";
                      Children.forEach(children, (child) => {
                        if (isValidElement(child) && child.props) {
                          codeText = String(child.props.children || "");
                        }
                      });

                      return (
                        <div className="relative group my-3">
                          <pre
                            className="p-3 rounded-lg bg-black/30 overflow-auto"
                            {...props}
                          >
                            {children}
                          </pre>
                          {codeText && (
                            <CopyToClipboard
                              text={codeText.replace(/\n$/, "")}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                            />
                          )}
                        </div>
                      );
                    },
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

      {/* AI README Builder Modal */}
      <Modal
        isOpen={isReadmeModalOpen}
        onClose={() => !isGeneratingReadme && !isSavingReadme && setIsReadmeModalOpen(false)}
        title="AI README Builder"
        size="xl"
      >
        {isGeneratingReadme ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-6 text-center">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
              <Sparkles className="h-6 w-6 text-primary absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Analyzing Repository & Drafting README</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Gemini is analyzing the file structure and manifest dependencies to build a highly accurate, technical README for your project...
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-[70vh] max-h-[600px] text-foreground">
            {/* Toolbar / Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4 mb-4 gap-3">
              <div className="flex bg-secondary-100 dark:bg-secondary-900 p-1 rounded-lg self-start">
                <button
                  onClick={() => setEditorMode("preview")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${editorMode === "preview"
                    ? "bg-white dark:bg-secondary-800 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </button>
                <button
                  onClick={() => setEditorMode("edit")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${editorMode === "edit"
                    ? "bg-white dark:bg-secondary-800 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Edit Markdown
                </button>
              </div>
              <div className="flex items-center gap-2 self-end">
                <button
                  onClick={handleGenerateReadme}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-secondary-100 dark:hover:bg-secondary-900 text-xs font-semibold transition-all"
                  title="Regenerate README"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate
                </button>
                <button
                  onClick={handleCopyReadme}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-secondary-100 dark:hover:bg-secondary-900 text-xs font-semibold transition-all"
                >
                  {hasCopied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleSaveReadme}
                  disabled={isSavingReadme}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-semibold shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
                >
                  {isSavingReadme ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      <span>Save to Overview</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Editor Workspace */}
            <div className="flex-1 overflow-hidden min-h-0 border border-border rounded-lg bg-background/50">
              {editorMode === "edit" ? (
                <textarea
                  value={editorText}
                  onChange={(e) => setEditorText(e.target.value)}
                  className="w-full h-full p-4 font-mono text-sm bg-black/15 text-foreground focus:outline-none resize-none overflow-y-auto leading-relaxed border-0 focus:ring-0"
                  placeholder="Paste or write Markdown here..."
                />
              ) : (
                <div className="w-full h-full p-4 overflow-y-auto text-sm leading-relaxed max-h-[400px]">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[
                      rehypeRaw,
                      [rehypeSanitize, readmeSanitizeSchema],
                    ]}
                    components={{
                      h1: (props) => <h1 className="text-xl sm:text-2xl font-bold mt-2 mb-3 border-b border-border/45 pb-2" {...props} />,
                      h2: (props) => <h2 className="text-lg sm:text-xl font-semibold mt-5 mb-2 border-b border-border/25 pb-1" {...props} />,
                      h3: (props) => <h3 className="text-base sm:text-lg font-semibold mt-4 mb-2" {...props} />,
                      p: (props) => <p className="my-2 text-sm leading-relaxed text-muted-foreground" {...props} />,
                      a: ({ href, children, ...props }) => (
                        <a
                          href={resolveRepoRelativeUrl(String(href || ""), "link")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline underline-offset-2 hover:text-primary/85 transition-colors"
                          {...props}
                        >
                          {children}
                        </a>
                      ),
                      img: ({ src, alt, title, ...props }) => {
                        const resolved = resolveRepoRelativeUrl(String(src || ""), "image");
                        // eslint-disable-next-line @next/next/no-img-element
                        return <img src={resolved} alt={alt || ""} title={title} loading="lazy" className="max-w-full h-auto rounded-md my-3" {...props} />;
                      },
                      code: ({ className, children, ...props }) => {
                        const isBlock = Boolean(className);
                        if (!isBlock) {
                          return <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono" {...props}>{children}</code>;
                        }
                        return <code className={`block whitespace-pre-wrap text-xs leading-relaxed font-mono ${className || ""}`} {...props}>{children}</code>;
                      },
                      pre: ({ children, ...props }) => (
                        <pre className="p-4 my-3 rounded-lg bg-black/25 border border-border/40 overflow-auto font-mono" {...props}>
                          {children}
                        </pre>
                      ),
                      ul: (props) => <ul className="list-disc pl-6 my-2 space-y-1 text-muted-foreground" {...props} />,
                      ol: (props) => <ol className="list-decimal pl-6 my-2 space-y-1 text-muted-foreground" {...props} />,
                      li: (props) => <li className="text-sm leading-relaxed" {...props} />,
                      hr: (props) => <hr className="my-4 border-border/50" {...props} />,
                      blockquote: (props) => <blockquote className="border-l-4 border-primary/40 pl-4 my-3 italic text-muted-foreground bg-muted/20 py-2 rounded-r-md" {...props} />,
                      table: (props) => (
                        <div className="my-3 overflow-auto border border-border rounded-lg">
                          <table className="min-w-full text-sm divide-y divide-border" {...props} />
                        </div>
                      ),
                      th: (props) => <th className="text-left font-semibold p-3 bg-muted text-foreground" {...props} />,
                      td: (props) => <td className="p-3 border-t border-border/50 text-muted-foreground" {...props} />,
                    }}
                  >
                    {editorText || "No markdown content yet."}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
