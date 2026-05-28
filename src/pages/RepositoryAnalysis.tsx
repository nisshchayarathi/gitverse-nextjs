"use client";

export const dynamic = "force-dynamic";
import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import Link from "next/link";
import RepositoryAnalysisProgress from "@/components/repository/RepositoryAnalysisProgress";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RepositoryOverview } from "@/components/repository/RepositoryOverview";
import { FileStructure } from "@/components/repository/FileStructure";
import { CommitHistory } from "@/components/repository/CommitHistory";
import { Contributors } from "@/components/repository/Contributors";
import { RepositoryInsights } from "@/components/repository/RepositoryInsights";
import { RepositoryMentorTab } from "@/components/ai/RepositoryMentorTab";
import { RepositoryIssues } from "@/components/repository/RepositoryIssues";

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
  AlertCircle,
  Copy,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/services/apiConfig";
import { Modal } from "@/components/ui/Modal";

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

type TabType =
  | "overview"
  | "files"
  | "commits"
  | "contributors"
  | "mentor"
  | "insights"
  | "issues";

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
  {
    id: "issues",
    label: "Good First Issues",
    icon: <Sparkles className="h-4 w-4 text-purple-400 animate-pulse" />,
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
  const pollingJobRef = useRef<string | null>(null);

  // Timeout / stuck state
  const [analysisTimedOut, setAnalysisTimedOut] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const pollingStartedAt = useRef<number | null>(null);
  // Tracks last time progress changed - prevents falsely timing out active jobs
  const lastProgressAt = useRef<number | null>(null);
  const elapsedTimer = useRef<NodeJS.Timeout | null>(null);

  // ── Elapsed seconds ticker ────────────────────────────────────────
  useEffect(() => {
    if (isAnalyzing && !analysisTimedOut) {
      if (!pollingStartedAt.current) {
        pollingStartedAt.current = Date.now();
      }
      elapsedTimer.current = setInterval(() => {
        if (pollingStartedAt.current) {
          setElapsedSeconds(
            Math.floor((Date.now() - pollingStartedAt.current) / 1000)
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

  // ── Initial fetch ─────────────────────────────────────────────────
  useEffect(() => {
    fetchRepository();
    fetchJobHistory();
  }, [id]);

  // ── Step progression simulation during active analysis ──
  useEffect(() => {
    if (!isAnalyzing) return;

    setCurrentStep(0);

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < 4) {
          return prev + 1;
        }
        return prev;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // ── Job polling ───────────────────────────────────────────────────
  useEffect(() => {
    fetchRepository();
  }, [id]);

  useEffect(() => {
    const jobId = job?.id || repository?.latestJob?.id;
    if (!jobId) return;

    if (pollingJobRef.current !== jobId) {
      pollingJobRef.current = jobId;
    } else {
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

      if (
        lastProgressAt.current &&
        Date.now() - lastProgressAt.current > ANALYSIS_TIMEOUT_MS
      ) {
        stopped = true;
        setAnalysisTimedOut(true);
        setIsAnalyzing(false);
        setAnalysisError(
          "Analysis has been queued for over 8 minutes without progress. " +
          "The background worker may not be running. Please try again later."
        );
        return;
      }

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
  }, [repository?.status, repository?.latestJob?.id, job?.id, job?.status]);

  // ── Fetch Repository ──────────────────────────────────────────────
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
          "Failed to load repository."
      );
      toast({
        title: "Error fetching repository",
        description: err.response?.data?.error || err.response?.data?.message || err.message || "Failed to load repository data.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  // ── Fetch Job Status ──────────────────────────────────────────────
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
      setJob((prevJob: any) => {
        const prevPercent = prevJob?.progressPercent ?? null;
        const prevMessage = prevJob?.progressMessage ?? null;

        const nextPercent = nextJob?.progressPercent ?? null;
        const nextMessage = nextJob?.progressMessage ?? null;

        if (nextPercent !== prevPercent || nextMessage !== prevMessage) {
          lastProgressAt.current = Date.now();
        }

        return {
          ...prevJob,
          ...nextJob,
          progressPercent:
            typeof nextJob?.progressPercent === "number" &&
            Number.isFinite(nextJob.progressPercent)
              ? nextJob.progressPercent
              : prevJob?.progressPercent ?? 0,

          progressMessage:
            typeof nextJob?.progressMessage === "string" &&
            nextJob.progressMessage.trim().length > 0
              ? nextJob.progressMessage
              : prevJob?.progressMessage ?? "Analyzing repository...",
        };
      });
      setJob(nextJob);

      if (nextJob?.status === "DONE") {
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
    } catch (err: any) {
      console.error("Error fetching analysis job:", err);
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Failed to connect to the analysis service.";
      setError(errorMessage);
      setIsAnalyzing(false);
      
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

  const fetchJobHistory = async () => {
    if (!id) return;

    try {
      setLoadingJobs(true);
      const token = localStorage.getItem("gitverse_token");

      const response = await axios.get(
        buildApiUrl(`/api/repositories/${id}/jobs`),
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      setJobs(response.data.jobs || []);
    } catch (error) {
      console.error("Error fetching job history:", error);
    } finally {
      setLoadingJobs(false);
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

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);

      toast({
        title: "Link copied",
        description: "Analysis job link copied to clipboard.",
      });
    } catch (error) {
      console.error("Failed to copy link:", error);

      toast({
        title: "Copy failed",
        description: "Unable to copy analysis link.",
        variant: "destructive",
      });
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
      case "issues":
        return <RepositoryIssues repository={repository} />;
      default:
        return <RepositoryOverview />;
    }
  };

  const formatElapsed = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  };

  const lastProgressMessageRef = useRef("Analyzing repository...");

  const safeProgressPercent = useMemo(() => {
    const value = Number(job?.progressPercent);

    if (Number.isNaN(value) || !Number.isFinite(value)) {
      return 0;
    }

    return Math.min(100, Math.max(0, value));
  }, [job?.progressPercent]);

  useEffect(() => {
    if (
      typeof job?.progressMessage === "string" &&
      job.progressMessage.trim().length > 0
    ) {
      lastProgressMessageRef.current = job.progressMessage;
    }
  }, [job?.progressMessage]);

  const safeProgressMessage =
    typeof job?.progressMessage === "string" &&
    job.progressMessage.trim().length > 0
      ? job.progressMessage
      : lastProgressMessageRef.current || "Analyzing repository...";

  // ── Render ────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {loading ? (
          <RepositoryAnalysisSkeleton />
        ) : error && !repository ? (
          <div className="glass border border-red-500/40 p-12 rounded-lg text-center space-y-4">
            <div className="flex justify-center text-red-500 text-4xl">⚠️</div>
            <h3 className="font-semibold text-lg text-red-400">Failed to Load Repository</h3>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 text-sm font-medium"
            >
              Back to Dashboard
            </button>
          </div>
        ) : !job ? (
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
            {/* Header with back, copy, and delete buttons */}
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

              <div className="flex items-center gap-2 self-end sm:self-center">
                {/* Copy and Delete buttons only if repository exists */}
                {repository && (
                  <>
                    <button
                      onClick={handleCopyLink}
                      className="glass p-2 rounded-lg hover:bg-white/10 transition-all duration-300 flex-shrink-0"
                      title="Copy analysis link"
                      aria-label="Copy analysis link"
                    >
                      <Copy className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>

                    <button
                      onClick={() => setShowDeleteDialog(true)}
                      className="glass p-2 rounded-lg hover:bg-red-500/20 transition-all duration-300 text-red-500 hover:text-red-400 flex-shrink-0"
                      title="Delete repository"
                    >
                      <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Main Content Area */}
            {isAnalyzing ? (
              /* ── Analyzing / Polling State ── */
              <div className="space-y-6 animate-fade-in-up">
                <RepositoryAnalysisProgress currentStep={currentStep} />

                <div className="glass rounded-lg p-12 text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold mb-2">Analyzing Repository</h2>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                      We're scanning and parsing the repository structure, commits, contributors, and more.
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4 max-w-sm mx-auto">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{safeProgressMessage}</span>
                      <span>{Math.round(safeProgressPercent)}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(2, safeProgressPercent)}%` }}
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
                  {elapsedSeconds > 60 && safeProgressPercent === 0 && (
                    <div className="mt-4 max-w-sm mx-auto p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <p className="text-xs text-yellow-400 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        Still queued after {formatElapsed(elapsedSeconds)}. The worker runs every 5 minutes via GitHub Actions — it should pick this up shortly.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : analysisTimedOut || analysisError ? (
              /* ── Timeout / error state ── */
              <div className="glass rounded-lg p-12 text-center space-y-6">
                <div className="flex justify-center">
                  <XCircle className="h-12 w-12 text-red-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold mb-2 text-red-400">
                    {analysisTimedOut ? "Analysis Timed Out" : "Analysis Failed"}
                  </h2>
                  <p className="text-muted-foreground max-w-md mx-auto text-sm">
                    {analysisError || "The repository analysis task took too long or failed to process."}
                  </p>
                </div>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 transition-all duration-300 text-sm font-medium shadow-lg shadow-primary/25"
                >
                  Back to Dashboard
                </button>
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
              /* ── Done — show tabs and history ── */
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
                <div className="animate-fade-in-up animate-fade-in-up-container mt-6">
                  {renderContent()}
                </div>

                {/* Analysis History */}
                <div className="glass rounded-lg p-6 mt-6">
                  <h2 className="text-2xl font-bold mb-4">
                    Analysis History
                  </h2>

                  {loadingJobs ? (
                    <p className="text-muted-foreground">
                      Loading analysis history...
                    </p>
                  ) : jobs.length === 0 ? (
                    <p className="text-muted-foreground">
                      No analysis history found.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {jobs.map((historyJob: any) => (
                        <div
                          key={historyJob.id}
                          onClick={() =>
                            router.push(`/analysis/${historyJob.id}`)
                          }
                          className="border rounded-lg p-4 cursor-pointer hover:bg-white/5 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-sm capitalize">
                                {historyJob.status?.toLowerCase()}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {historyJob.summary || "No summary available"}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(historyJob.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                  <span>Deleting...</span>
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
    </DashboardLayout>
  );
}
