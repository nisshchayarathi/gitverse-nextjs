"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RepositoryOverview } from "@/components/repository/RepositoryOverview";
import { FileStructure } from "@/components/repository/FileStructure";
import { CommitHistory } from "@/components/repository/CommitHistory";
import { Contributors } from "@/components/repository/Contributors";
import { RepositoryInsights } from "@/components/repository/RepositoryInsights";
import { RepositoryMentorTab } from "@/components/ai/RepositoryMentorTab";
import { AIRepositoryOverlay } from "@/components/ai/AIRepositoryOverlay";

import {
  Home,
  FolderTree,
  GitCommit,
  Users,
  Sparkles,
  BarChart3,
  ArrowLeft,
  Trash2,
  Activity,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/services/apiConfig";
import { Modal } from "@/components/ui/Modal";

type TabType =
  | "overview"
  | "files"
  | "commits"
  | "contributors"
  | "mentor"
  | "insights";

interface Tab {
  id: TabType;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: "overview", label: "Overview", icon: <Home className="h-4 w-4" /> },
  { id: "files", label: "Files", icon: <FolderTree className="h-4 w-4" /> },
  { id: "commits", label: "Commits", icon: <GitCommit className="h-4 w-4" /> },
  {
    id: "contributors",
    label: "Contributors",
    icon: <Users className="h-4 w-4" />,
  },
  {
    id: "mentor",
    label: "AI Mentor",
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    id: "insights",
    label: "Insights",
    icon: <BarChart3 className="h-4 w-4" />,
  },
];

const StatusBadge = ({ status, isAnalyzing }: { status: string; isAnalyzing: boolean }) => {
  const s = status?.toLowerCase() || "pending";

  if (isAnalyzing || s === "analyzing" || s === "processing") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse">
        <Loader2 className="h-3 w-3 animate-spin" />
        Analyzing
      </span>
    );
  }

  if (s === "completed" || s === "done" || s === "ready") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
        <CheckCircle2 className="h-3 w-3" />
        Completed
      </span>
    );
  }

  if (s === "failed" || s === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
        <XCircle className="h-3 w-3" />
        Failed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
      <Clock className="h-3 w-3" />
      Pending
    </span>
  );
};

export default function RepositoryAnalysis() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [repository, setRepository] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [job, setJob] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingStartedAt = useRef<number | null>(null);
  const pollingJobRef = useRef<string | null>(null);

  useEffect(() => {
    fetchRepository();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    // Guard against dual-polling when the dependency array changes mid-cycle.
    const jobId = job?.id || repository?.latestJob?.id;
    if (!jobId) return;

    if (pollingJobRef.current !== jobId) {
      pollingJobRef.current = jobId;
    } else {
      // Same jobId triggered a re-run; bail to avoid stacking loops.
      return;
    }

    const repoStatus = repository?.status as string | undefined;
    const jobStatus = job?.status as string | undefined;

    const shouldShowAnalyzing =
      repoStatus === "pending" ||
      repoStatus === "analyzing" ||
      jobStatus === "QUEUED" ||
      jobStatus === "PROCESSING";

    setIsAnalyzing(Boolean(shouldShowAnalyzing));

    if (jobStatus === "DONE" || jobStatus === "FAILED") return;

    let stopped = false;
    let intervalMs = 2000;
    let retries = 0;
    const MAX_RETRIES = 60;

    const poll = async () => {
      if (stopped) return;
      if (retries >= MAX_RETRIES) {
        setError(
          "Analysis is taking longer than expected. The job may still be processing — check back later."
        );
        return;
      }
      retries++;
      await fetchJob(jobId);
      if (stopped) return;
      setTimeout(poll, intervalMs);
      intervalMs = Math.min(5000, intervalMs + 500);
    };

    poll();

    return () => {
      stopped = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository?.status, repository?.latestJob?.id, job?.id, job?.status]);

  const fetchRepository = async () => {
    if (!id) return;
    setError(null);

    try {
      const token = localStorage.getItem("gitverse_token");
      const response = await axios.get(buildApiUrl(`/api/repositories/${id}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const repo = response.data.repository || response.data;
      setRepository(repo);

      const repoStatus = repo?.status?.toLowerCase();
      if (repoStatus === "failed" || repoStatus === "error") {
        setError(repo?.error || "Analysis failed. Please try again later.");
      }

      if (response.data.latestJob) {
        setJob(response.data.latestJob);
        if (response.data.latestJob.status === "FAILED") {
          setError(response.data.latestJob.error || "Analysis failed. Please try again later.");
        }
      }
      setLoading(false);
    } catch (err: any) {
      console.error("Error fetching repository:", err);

      const isColdStart = err.response?.data?.error === "DATABASE_COLD_START";
      
      if (isColdStart) {
        setError("Waking up database... Please wait.");
        // Auto-retry in 3 seconds. Do not set loading to false so spinner stays.
        setTimeout(fetchRepository, 3000);
        return;
      }

      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          "Analysis failed. Please try again later."
      );
      toast({
        title: "Error fetching repository",
        description: err.response?.data?.error || err.response?.data?.message || err.message || "Failed to load repository data.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const fetchJob = async (jobId: string) => {
    if (!jobId) return;

    try {
      const token = localStorage.getItem("gitverse_token");
      const response = await axios.get(
        buildApiUrl(`/api/analysis-jobs/${jobId}`),
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const nextJob = response.data.job || response.data;
      setJob(nextJob);

      if (nextJob?.status === "DONE") {
        // Job finished — refresh repository once to load results.
        await fetchRepository();
      }

      if (nextJob?.status === "FAILED") {
        const msg = nextJob?.error || "The repository analysis failed.";

        setError(msg);

        pollingStartedAt.current = null;
        setIsAnalyzing(false);
        toast({
          title: "Analysis failed",
          description: msg,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Error fetching analysis job:", err);
      
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || "Failed to connect to the analysis service.";
      
      // 1. Surface inline error state
      setError(errorMessage);
      
      // 2. Stop polling
      setIsAnalyzing(false);

      // 3. Show a one-time toast notification
      toast({
        title: "Error checking analysis status",
        description: err.response?.data?.error || err.response?.data?.message || err.message || "Failed to connect to the analysis service.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRepository = async () => {
    if (!id) return;
    setIsDeleting(true);

    try {
      const token = localStorage.getItem("gitverse_token");
      await axios.delete(buildApiUrl(`/api/repositories/${id}`), {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast({
        title: "Repository deleted",
        description: "The repository has been successfully deleted.",
      });

      router.push("/dashboard");
    } catch (error: any) {
      console.error("Error deleting repository:", error);
      toast({
        title: "Error",
        description:
          error.response?.data?.error || "Failed to delete repository",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return <RepositoryOverview repositoryData={repository} />;
      case "files":
        return <FileStructure repository={repository} />;
      case "commits":
        return <CommitHistory repository={repository} />;
      case "contributors":
        return <Contributors repository={repository} />;
      case "mentor":
        return <RepositoryMentorTab repositoryData={repository} />;
      case "insights":
        return <RepositoryInsights repository={repository} />;
      default:
        return <RepositoryOverview />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {loading ? (
          <div className="glass rounded-lg p-12 text-center space-y-4">
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
            <div>
              <h3 className="font-semibold text-lg">Loading Repository</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Fetching repository data and analysis results...
              </p>
            </div>
          </div>
        ) : !job && !error ? (
          <div className="text-center py-12 flex flex-col items-center gap-4 animate-fade-in-up">
            <Activity className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <h3 className="font-semibold text-lg">No analysis jobs found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Run your first analysis to get started
              </p>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 transition-all duration-300 text-sm font-medium"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <>
            {/* Header with back button */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 animate-fade-in-up">
              <Link
                href="/dashboard"
                className="glass p-2 rounded-lg hover:bg-white/10 transition-all duration-300 self-start"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Link>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold truncate">
                  {repository?.name || "Repository Analysis"}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">
                  {repository?.url || ""}
                </p>
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge
                      status={
                        error
                          ? "failed"
                          : repository?.status || job?.status || "pending"
                      }
                      isAnalyzing={isAnalyzing}
                    />
                  </div>
                  {error && (
                    <p className="text-xs sm:text-sm text-red-500 font-medium mt-1">
                      {error}
                    </p>
                  )}
                </div>
              </div>
              {/* Delete button only if repository exists */}
              {repository && (
                <button
                  onClick={() => setShowDeleteDialog(true)}
                  className="glass p-2 rounded-lg hover:bg-red-500/20 transition-all duration-300 text-red-500 hover:text-red-400 flex-shrink-0"
                  title="Delete repository"
                >
                  <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              )}
            </div>

            {isAnalyzing ? (
              <div className="glass rounded-lg p-12 text-center space-y-4 animate-pulse">
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
                </div>
                <div>
                  <h2 className="text-xl font-semibold mb-2">
                    Analyzing Repository
                  </h2>
                  <p className="text-muted-foreground">
                    We&apos;re analyzing the repository structure, commits,
                    contributors, and more.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {job?.progressPercent != null && job?.progressPercent >= 0
                      ? `${Math.min(Math.round(job.progressPercent), 100)}%${job?.progressMessage ? ` — ${job.progressMessage}` : ""}`
                      : job?.progressMessage
                        ? job.progressMessage
                        : "This may take a few moments depending on the repository size..."}
                  </p>
                </div>
                <div className="flex justify-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <GitCommit className="h-4 w-4" />
                    Processing commits
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Finding contributors
                  </div>
                </div>
              </div>
            ) : error && !repository ? (
              <div className="glass rounded-lg p-12 text-center space-y-4 animate-fade-in-up">
                <div className="flex justify-center">
                  <XCircle className="h-12 w-12 text-red-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-red-500">Failed to Load Repository</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {error}
                  </p>
                </div>
                <button
                  onClick={() => fetchRepository()}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 transition-all duration-300 text-sm font-medium shadow-lg shadow-primary/25"
                >
                  Retry Loading
                </button>
              </div>
            ) : (
              <>
                {/* Tab navigation */}
                <div className="glass rounded-lg p-2 animate-fade-in-up">
                  <div className="flex gap-2 overflow-x-auto">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                          flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 whitespace-nowrap w-full sm:w-auto justify-center
                          ${
                            activeTab === tab.id
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                              : "hover:bg-white/10 text-muted-foreground hover:text-foreground"
                          }
                        `}
                      >
                        {tab.icon}
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Content */}
                <div className="animate-fade-in-up">{renderContent()}</div>
              </>
            )}
          </>
        )}

        {/* Delete Confirmation Dialog */}
        <Modal
          isOpen={showDeleteDialog}
          onClose={() => !isDeleting && setShowDeleteDialog(false)}
          size="sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 mb-4">
            <div className="p-2 sm:p-3 rounded-lg bg-red-500/10 flex-shrink-0">
              <Trash2 className="h-5 w-5 sm:h-6 sm:w-6 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg sm:text-xl font-bold mb-2">
                Delete Repository
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Are you sure you want to delete{" "}
                <strong className="break-words">{repository?.name}</strong>?
                This action cannot be undone and will permanently remove all
                repository data, including commits, contributors, and
                analysis results.
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end">
            <button
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
              className="px-3 sm:px-4 py-2 rounded-lg border border-secondary-200 dark:border-secondary-700 hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-all duration-300 disabled:opacity-50 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteRepository}
              disabled={isDeleting}
              className="px-3 sm:px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 text-sm text-white"
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                  <span className="hidden sm:inline">Deleting...</span>
                  <span className="sm:hidden">Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>Delete Repository</span>
                </>
              )}
            </button>
          </div>
        </Modal>
      </div>
      {/* Floating AI Chat Overlay with Global Codebase RAG */}
      {repository && (
        <AIRepositoryOverlay
          repository={{
            id: repository.id,
            name: repository.name,
            description: repository.description,
            languages: repository.languages || [],
            stats: {
              commits: repository.commits?.length || 0,
              contributors: repository.contributors?.length || 0,
              files: repository.files?.length || 0,
              branches: repository.branches?.length || 0,
              stars: repository.stars || 0,
              forks: repository.forks || 0,
            },
            recentCommits: repository.commits || [],
            contributors: repository.contributors || [],
            branches: repository.branches || [],
          }}
        />
      )}
    </DashboardLayout>
  );
}
