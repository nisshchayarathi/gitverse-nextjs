"use client";

export const dynamic = "force-dynamic";
import { useState, useEffect, useRef, useMemo } from "react";

import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import Link from "next/link";


import { useState, useEffect, useRef } from "react";
import RepositoryAnalysisProgress  from "@/components/repository/RepositoryAnalysisProgress";
import { useParams } from "next/navigation";
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
  Copy,
  CheckCircle2,
  Clock,
  RefreshCw,
  Loader2,
  XCircle,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
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
  const [currentStep, setCurrentStep] = useState(0);
  const [job, setJob] = useState<any>(null);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingJobRef = useRef<string | null>(null);

  // Timeout / stuck state
  const [analysisTimedOut, setAnalysisTimedOut] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const pollingStartedAt = useRef<number | null>(null);
  // Tracks last time progress changed  prevents falsely timing out active jobs
  const lastProgressAt = useRef<number | null>(null);
  const elapsedTimer = useRef<NodeJS.Timeout | null>(null);

  // ── Elapsed seconds ticker ────────────────────────────────────────
  useEffect(() => {
    if (isAnalyzing && !analysisTimedOut) {
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

  // â”€â”€ Initial fetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // ── Initial fetch ─────────────────────────────────────────────────� Initial fetch ─────────────────────────────────────────────────
  useEffect(() => {
  fetchRepository();
  fetchJobHistory();
}, [id]);

  // â”€â”€ Job polling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!job || job.status === "DONE" || job.status === "FAILED") return;

    const repoStatus = repository?.status;
    const jobStatus = job?.status;
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
          "or contact the maintainer."
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

  // =========================
  // FETCH REPOSITORY (FIXED)
  // =========================
  const fetchRepository = async () => {
    if (!id) return;

    setError(null); // âœ… reset error on retry
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

  const fetchRepository = async () => {
    if (!id) return;
    setError(null);

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
    } catch (error: any) {
      setError(
        error?.response?.data?.error ||
        "Failed to load repository. Check your connection and try again."
      );

      toast({
        title: "Error",
        description: "Failed to load repository data",
      console.log("Repository data:", response.data);
    } catch (err: any) {
      console.error("Error fetching repository:", err);
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
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const nextJob = response.data.job || response.data;
      // Use functional setJob so we always compare against the latest job
      // state, avoiding the stale-closure bug where the polling loop holds
      // an old snapshot of job and never sees progress-only updates.
      setJob((prevJob: { progressPercent: null; progressMessage: null; }) => {
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
      if (nextJob?.status === "DONE") {
        // Job finished — refresh repository once to load results.
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
        setError(nextJob?.error || "Analysis failed. Please try again later.");
        toast({
          title: "Analysis failed",
          description: nextJob?.error || nextJob?.progressMessage || "The repository analysis encountered an unexpected error.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Error fetching analysis job:", err);
      
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || "Failed to connect to the analysis service.";
      
      // 1. Surface inline error state
      setError(errorMessage);
      
      // 2. Stop polling to prevent spamming the user/server
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      setIsPolling(false); // If you are tracking polling via a boolean state

      // 3. Show a one-time toast notification
      toast({
        title: "Error checking analysis status",
        description: errorMessage,
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

  // â”€â”€ Tab content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      default:
        return <RepositoryOverview repositoryData={repository} />;
    }
  };

  // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
              <button
  onClick={handleCopyLink}
  className="glass p-2 rounded-lg hover:bg-white/10 transition-all duration-300 flex-shrink-0"
  title="Copy analysis link"
  aria-label="Copy analysis link"
>
  <Copy className="h-4 w-4 sm:h-5 sm:w-5" />
</button>
              {/* Delete button */}
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="glass p-2 rounded-lg hover:bg-red-500/20 transition-all duration-300 text-red-500 hover:text-red-400 flex-shrink-0"
                title="Delete repository"
              >
                <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
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

            {/* {isAnalyzing ? (
              <div className="glass rounded-lg p-12 text-center space-y-4 animate-pulse">
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
                </div>
                <div> */}

                {isAnalyzing ? (
  <div className="animate-fade-in-up">
    <RepositoryAnalysisProgress currentStep={currentStep} />

    <div className="mt-6 glass rounded-lg p-4 text-center">
      <p className="text-sm text-muted-foreground">
        {job?.progressPercent != null && job?.progressPercent >= 0
          ? `${Math.min(Math.round(job.progressPercent), 100)}% complete`
          : "Processing repository analysis..."}
      </p>

      {job?.progressMessage && (
        <p className="text-sm mt-2 text-primary font-medium">
          {job.progressMessage}
        </p>
      )}
    </div>
  </div>
) : error && !repository ? (

                  <h2 className="text-xl font-semibold mb-2">
                    Analyzing Repository
                  </h2>
                  <p className="text-muted-foreground">
                    We&apos;re analyzing the repository structure, commits,
                    contributors, and more.
                  </p>

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
                  {elapsedSeconds > 60 && safeProgressPercent === 0  && (
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
                    {analysisTimedOut ? "Analysis Timed Out" : "Analysis Failed"}
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
                {/* Content */}
<div className="animate-fade-in-up">
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
              <p className="font-semibold">
                {historyJob.status}
              </p>

              <p className="text-sm text-muted-foreground">
                {historyJob.summary || "No summary available"}
              </p>

              <p className="text-xs text-muted-foreground mt-1">
                {new Date(
                  historyJob.createdAt,
                ).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
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
    </DashboardLayout>
  );
}


