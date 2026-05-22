"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import Link from "next/link";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RepositoryOverview } from "@/components/repository/RepositoryOverview";
import { FileStructure } from "@/components/repository/FileStructure";
import { CommitHistory } from "@/components/repository/CommitHistory";
import { Contributors } from "@/components/repository/Contributors";
import { RepositoryInsights } from "@/components/repository/RepositoryInsights";
import { RepositoryMentorTab } from "@/components/ai/RepositoryMentorTab";

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
  AlertCircle,
  Clock,
  RefreshCw,
  RotateCcw,
  SearchX,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/ui";
import { buildApiUrl } from "@/services/apiConfig";
// Local fallback skeleton UI (avoids missing import)
const RepositoryAnalysisSkeleton: React.FC = () => {
  return (
    <div className="glass p-6 rounded-lg">
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-1/3 bg-muted rounded" />
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-40 w-full bg-muted rounded" />
      </div>
    </div>
  );
};

// How long before we stop polling and show a "stuck" error (8 minutes)
const ANALYSIS_TIMEOUT_MS = 8 * 60 * 1000;
// Start polling every 2s, back off to 5s max
const POLL_INTERVAL_INITIAL_MS = 2000;
const POLL_INTERVAL_MAX_MS = 5000;
const POLL_INTERVAL_STEP_MS = 500;

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
  { id: "mentor", label: "AI Mentor", icon: <Sparkles className="h-4 w-4" /> },
  {
    id: "insights",
    label: "Insights",
    icon: <BarChart3 className="h-4 w-4" />,
  },
];

export default function RepositoryAnalysis() {
  const params = useParams();
  const id = params?.id as string;

  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [repository, setRepository] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, _setIsAnalyzing] = useState(false);
  const [job, setJob] = useState<any>(null);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // âœ… ERROR STATE (improved usage)
  const [error, setError] = useState<string | null>(null);

  // Timeout / stuck state
  const [analysisTimedOut, setAnalysisTimedOut] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const pollingStartedAt = useRef<number | null>(null);
  // Tracks last time progress changed — prevents falsely timing out active jobs
  const lastProgressAt = useRef<number | null>(null);
  const elapsedTimer = useRef<NodeJS.Timeout | null>(null);

  // â”€â”€ Elapsed seconds ticker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (isAnalyzing && !analysisTimedOut) {
      elapsedTimer.current = setInterval(() => {
        if (pollingStartedAt.current) {
          setElapsedSeconds(
            Math.floor((Date.now() - pollingStartedAt.current) / 1000),
          );
        }
      }, 1000);
    } else {
      if (elapsedTimer.current) clearInterval(elapsedTimer.current);
    }
    return () => {
      if (elapsedTimer.current) clearInterval(elapsedTimer.current);
    };
  }, [isAnalyzing, analysisTimedOut]);

  // â”€â”€ Initial fetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    fetchRepository();
  }, [id]);

  // â”€â”€ Job polling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!job || job.status === "DONE" || job.status === "FAILED") return;

    const repoStatus = repository?.status;
    const jobStatus = job?.status;

    const shouldAnalyze =
      repoStatus === "pending" ||
      repoStatus === "analyzing" ||
      jobStatus === "QUEUED" ||
      jobStatus === "PROCESSING";

    setIsAnalyzing(Boolean(shouldAnalyze));

    const jobId = job?.id || repository?.latestJob?.id;
    if (!jobId) return;
    if (jobStatus === "DONE" || jobStatus === "FAILED") return;
    if (analysisTimedOut) return;

    // Record when we started polling (only once per analysis)
    if (!pollingStartedAt.current) {
      pollingStartedAt.current = Date.now();
    }
    if (!lastProgressAt.current) {
      lastProgressAt.current = Date.now();
    }

    let stopped = false;
    let intervalMs = POLL_INTERVAL_INITIAL_MS;

    const poll = async () => {
      if (stopped) return;

      // â”€â”€ Timeout guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (
        lastProgressAt.current &&
        Date.now() - lastProgressAt.current > ANALYSIS_TIMEOUT_MS
      ) {
        stopped = true;
        setAnalysisTimedOut(true);
        setIsAnalyzing(false);
        setAnalysisError(
          "Analysis has been queued for over 8 minutes without progress. " +
            "The background worker may not be running. Please try again later " +
            "or contact the maintainer.",
        );
        return;
      }

      await fetchJob(jobId);
      if (stopped) return;

      setTimeout(poll, intervalMs);
      intervalMs = Math.min(
        POLL_INTERVAL_MAX_MS,
        intervalMs + POLL_INTERVAL_STEP_MS,
      );
    };

    poll();

    return () => {
      stopped = true;
    };
    // analysisTimedOut included so Check Again restarts polling
  }, [
    repository?.status,
    repository?.latestJob?.id,
    job?.id,
    job?.status,
    analysisTimedOut,
  ]);

  // â”€â”€ Data fetchers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const fetchRepository = async () => {
    if (!id) return;

    setError(null); // âœ… reset error on retry

    try {
      const token = localStorage.getItem("gitverse_token");

      const response = await axios.get(
        buildApiUrl(`/api/repositories/${id}`),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const repo = response.data.repository || response.data;
      setRepository(repo);
      if (response.data.latestJob) {
        setJob(response.data.latestJob);
      }
    } catch (error: any) {
      setError(
        error?.response?.data?.error ||
        "Failed to load repository. Check your connection and try again."
      );

      toast({
        title: "Error",
        description: "Failed to load repository data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchJob = async (jobId: string) => {
    if (!jobId) return;
    try {
      const token = localStorage.getItem("gitverse_token");

      const response = await axios.get(
        buildApiUrl(`/api/analysis-jobs/${jobId}`),
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const nextJob = response.data.job || response.data;
      // Use functional setJob so we always compare against the latest job
      // state, avoiding the stale-closure bug where the polling loop holds
      // an old snapshot of job and never sees progress-only updates.
      setJob((prevJob: any) => {
        const prevPercent = prevJob?.progressPercent ?? null;
        const prevMessage = prevJob?.progressMessage ?? null;
        const nextPercent = nextJob?.progressPercent ?? null;
        const nextMessage = nextJob?.progressMessage ?? null;
        if (nextPercent !== prevPercent || nextMessage !== prevMessage) {
          lastProgressAt.current = Date.now();
        }
        return nextJob;
      });

      if (nextJob?.status === "DONE") {
        pollingStartedAt.current = null;
        await fetchRepository();
      }

      if (nextJob?.status === "FAILED") {
        const msg = nextJob?.error || "The repository analysis failed.";

        setError(msg);

        pollingStartedAt.current = null;
        setIsAnalyzing(false);
        setAnalysisError(nextJob?.error || "The repository analysis failed.");
        toast({
          title: "Analysis failed",
          description: msg,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch analysis job status",
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
        return <RepositoryOverview repositoryData={repository} />;
    }
  };

const lastAnalyzedDate = repository?.lastAnalyzedAt
  ? new Date(repository.lastAnalyzedAt)
  : null;

const formattedLastAnalyzed =
  lastAnalyzedDate && !isNaN(lastAnalyzedDate.getTime())
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(lastAnalyzedDate)
    : "Not available";

const formatElapsed = (secs: number) => {
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
};

const progressPercent = job?.progressPercent ?? 0;
const progressMessage = job?.progressMessage || "Queued";

return (
    <DashboardLayout>
      <div className="space-y-6">
        {showDeleteDialog && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
            <div className="glass p-6 rounded-lg max-w-sm mx-4">
              <h2 className="text-lg font-semibold mb-2">Delete Repository?</h2>
              <p className="text-sm text-muted-foreground mb-6">
                This action cannot be undone. The repository and all its data will be permanently deleted.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteDialog(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteRepository}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <RepositoryAnalysisSkeleton />
        ) : error ? (
          <div className="glass border border-red-500/40 p-4 rounded-lg text-red-300 flex items-start gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        ) : !job ? (
          <EmptyState
            icon={Activity}
            title="No analysis jobs found"
            description="We couldn't find any analysis history for this repository. Run your first analysis to get started!"
            actionLabel="Go to Dashboard"
            onAction={() => router.push("/dashboard")}
          />
        ) : (
          <>
            {/* âœ… IMPROVED ERROR UI */}
            {error && (
              <div className="glass border border-red-500/40 p-4 rounded-lg text-red-300 flex items-start gap-2">
                <span>âš ï¸</span>
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <Link href="/dashboard" className="glass p-2 rounded-lg hover:bg-white/10">
                <ArrowLeft className="h-4 w-4" />
              </Link>

              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold truncate">
                  {repository?.name || "Repository"}
                </h1>

                <p className="text-sm text-muted-foreground truncate">
                  {repository?.url || "No URL available"}
                </p>

                <p className="text-xs text-muted-foreground mt-1">
                  Status:{" "}
                  <span className="capitalize">
                    {repository?.status || "unknown"}
                  </span>
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                <p className="text-xs text-muted-foreground">
                Status:{" "}
                <span className="capitalize">{repository.status}</span>
                </p>

                <p className="text-xs text-muted-foreground">
                  Last analyzed:{" "}
                  <span>{formattedLastAnalyzed}</span>
                </p>

                {isAnalyzing && (
                <span className="flex items-center gap-1 text-xs text-primary">
                <span className="animate-pulse">â—</span>
                Analyzing...
                </span>
                  )}
              </div>
              </div>
              <button
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting}
                className="glass p-2 rounded-lg text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* â”€â”€ Analyzing spinner (with timeout awareness) â”€â”€ */}
            {isAnalyzing && !analysisTimedOut ? (
              <div className="glass rounded-lg p-12 text-center space-y-6">
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold mb-2">
                    Analyzing Repository
                  </h2>
                  <p className="text-muted-foreground">
                    We&apos;re analyzing structure, commits, contributors, and
                    more.
                  </p>

                  {/* Progress bar */}
                  <div className="mt-4 max-w-sm mx-auto">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{progressMessage}</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(2, progressPercent)}%` }}
                      />
                    </div>
                  </div>

                  {/* Elapsed time */}
                  <p className="text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3" />
                    {elapsedSeconds > 0
                      ? `Running for ${formatElapsed(elapsedSeconds)}`
                      : "Starting up..."}
                  </p>

                  {/* Warn if queued too long (>60s with no progress) */}
                  {elapsedSeconds > 60 && progressPercent === 0 && (
                    <div className="mt-4 max-w-sm mx-auto p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <p className="text-xs text-yellow-400 flex items-start gap-2">
                        <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        Still queued after {formatElapsed(elapsedSeconds)}. 
                        The worker runs every 5 minutes via GitHub Actions â€” 
                        it should pick this up shortly.
                      </p>
                    </div>
                  )}
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
            ) : analysisTimedOut || analysisError ? (
              /* â”€â”€ Timeout / error state â”€â”€ */
              <div className="glass rounded-lg p-12 text-center space-y-6">
                <div className="flex justify-center">
                  <div className="p-4 rounded-full bg-red-500/10">
                    <AlertCircle className="h-12 w-12 text-red-400" />
                  </div>
                </div>
                <div>
                  <h2 className="text-xl font-semibold mb-2 text-red-400">
                    {analysisTimedOut
                      ? "Analysis Timed Out"
                      : "Analysis Failed"}
                  </h2>
                  <p className="text-muted-foreground max-w-md mx-auto text-sm">
                    {analysisError}
                  </p>
                </div>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => {
                      setAnalysisTimedOut(false);
                      setAnalysisError(null);
                      pollingStartedAt.current = null;
                      lastProgressAt.current = null;
                      setElapsedSeconds(0);
                      fetchRepository();
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg glass hover:bg-white/10 transition-all duration-300 text-sm"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Check Again
                  </button>
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/80 transition-all duration-300 text-sm"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Dashboard
                  </button>
                </div>
              </div>
            ) : (
              /* â”€â”€ Done â€” show tabs â”€â”€ */
              <>
                <div className="glass rounded-lg p-2">
                  <div className="flex gap-2 overflow-x-auto">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                          flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 whitespace-nowrap
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
                <div className="animate-fade-in-up">{renderContent()}</div>
              </>
            )}
          </>
        )}

        {/* Delete Confirmation Dialog */}
        {showDeleteDialog && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => !isDeleting && setShowDeleteDialog(false)}
          >
            <div
              className="glass max-w-md w-full p-4 sm:p-6 rounded-lg animate-fade-in-up"
              onClick={(e) => e.stopPropagation()}
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
                  className="px-3 sm:px-4 py-2 rounded-lg glass hover:bg-white/10 transition-all duration-300 disabled:opacity-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteRepository}
                  disabled={isDeleting}
                  className="px-3 sm:px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                      Delete Repository
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}