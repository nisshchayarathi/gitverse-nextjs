"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui";
import RepositoryAnalysisProgress from "@/components/repository/RepositoryAnalysisProgress";

interface JobData {
  id: string;
  status: "QUEUED" | "PROCESSING" | "DONE" | "FAILED";
  progressPercent: number | null;
  progressMessage: string | null;
  repositoryId: number;
  error: string | null;
}

export default function AnalysisJobPage({ params }: { params: { jobId: string } }) {
  const router = useRouter();
  const [job, setJob] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const jobId = params.jobId;
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchJobStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/analysis-jobs/${jobId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Analysis job not found.");
        }
        throw new Error("Failed to fetch job status.");
      }
      const data = await response.json();
      setJob(data.job);
      setError(null);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchJobStatus();
  }, [fetchJobStatus]);

  useEffect(() => {
    if (!job) return;

    if (job.status === "QUEUED" || job.status === "PROCESSING") {
      pollIntervalRef.current = setInterval(() => {
        fetchJobStatus();
      }, 3000);
    }

    if (job.status === "DONE" || job.status === "FAILED") {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [job, fetchJobStatus]);

  useEffect(() => {
    if (job?.status === "DONE" && job.repositoryId) {
      const redirectTimeout = setTimeout(() => {
        router.push(`/repo/${job.repositoryId}`);
      }, 3000);
      return () => clearTimeout(redirectTimeout);
    }
  }, [job?.status, job?.repositoryId, router]);

  if (loading && !job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-4 text-center" role="status" aria-live="polite" aria-label="Loading Job Details">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" aria-hidden="true" />
        <h2 className="text-xl font-semibold text-foreground">Loading Job Details...</h2>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-4 text-center" role="alert" aria-live="assertive">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" aria-hidden="true" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Job Error</h2>
        <p className="text-muted-foreground mb-6 max-w-md">{error || "Job not found"}</p>
        <Button onClick={() => router.push("/dashboard")} variant="default" aria-label="Back to Dashboard">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-[80vh]" aria-live="polite" aria-atomic="true">
      {job.status === "QUEUED" && (
        <div className="flex flex-col items-center text-center space-y-4" role="status">
          <Loader2 className="h-12 w-12 text-primary animate-spin" aria-hidden="true" />
          <h2 className="text-3xl font-bold font-heading text-foreground">Analysis Queued</h2>
          <p className="text-muted-foreground max-w-lg">
            Your repository analysis job is in the queue and will start processing shortly. Please wait...
          </p>
        </div>
      )}

      {job.status === "PROCESSING" && (
        <div className="w-full max-w-3xl" role="status" aria-label="Analysis is processing">
          <RepositoryAnalysisProgress 
            currentStep={job.progressPercent ? Math.floor((job.progressPercent / 100) * 5) : 0} 
          />
          {job.progressMessage && (
            <p className="text-center text-muted-foreground mt-6 text-sm" aria-live="polite">
              Status: {job.progressMessage}
            </p>
          )}
        </div>
      )}

      {job.status === "DONE" && (
        <div className="flex flex-col items-center text-center space-y-6" role="status" aria-label="Analysis complete">
          <div className="h-20 w-20 rounded-full bg-success/20 flex items-center justify-center" aria-hidden="true">
            <svg
              className="h-10 w-10 text-success"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-3xl font-bold font-heading text-foreground mb-2">Analysis Complete!</h2>
            <p className="text-muted-foreground">Redirecting you to the repository dashboard...</p>
          </div>
          <Button onClick={() => router.push(`/repo/${job.repositoryId}`)} className="mt-4" aria-label="View Repository Now">
            View Repository Now
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      {job.status === "FAILED" && (
        <div className="flex flex-col items-center text-center space-y-6" role="alert" aria-live="assertive">
          <AlertCircle className="h-16 w-16 text-destructive" aria-hidden="true" />
          <div>
            <h2 className="text-3xl font-bold font-heading text-foreground mb-2">Analysis Failed</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              {job.error || "An error occurred while analyzing the repository. Please try again."}
            </p>
          </div>
          <div className="flex gap-4">
            <Button onClick={() => router.push("/contribute")} variant="outline" aria-label="Analyze Another Repository">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Analyze Another
            </Button>
            <Button onClick={() => window.location.reload()} variant="default" aria-label="Retry Job">
              Retry Job
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
