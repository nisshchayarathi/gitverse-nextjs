"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import Link from "next/link";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DeadCodePanel } from "@/components/dead-code/DeadCodePanel";
import { analyzeDeadCode } from "@/lib/dead-code-analyzer";
import { buildApiUrl } from "@/services/apiConfig";

import {
  ArrowLeft,
  Loader2,
  FileX2,
  Activity,
  BarChart3,
  RefreshCw,
} from "lucide-react";

export default function DeadCodePageClient() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [repository, setRepository] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const files = useMemo(() => {
    if (!repository?.files) return [];
    return repository.files;
  }, [repository?.files]);

  const findings = useMemo(() => {
    if (!files.length) return [];
    return analyzeDeadCode(files);
  }, [files]);

  const fetchRepository = useCallback(async () => {
    if (!id) return;
    setError(null);

    try {
      const token = localStorage.getItem("gitverse_token");
      const response = await axios.get(buildApiUrl(`/api/repositories/${id}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const repo = response.data.repository || response.data;
      setRepository(repo);
      setLoading(false);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401) {
        setError("Your session has expired. Please log in again.");
        setLoading(false);
        return;
      }
      const isColdStart = err.response?.data?.error === "DATABASE_COLD_START";
      if (isColdStart) {
        setError("Waking up database... Please wait.");
        setTimeout(fetchRepository, 3000);
        return;
      }
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          "Failed to load repository data."
      );
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRepository();
  }, [fetchRepository]);

  const handleReanalyze = async () => {
    try {
      setAnalyzing(true);
      const token = localStorage.getItem("gitverse_token");
      await axios.post(
        buildApiUrl(`/api/repositories/${id}/analyze`),
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchRepository();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to re-analyze");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {loading ? (
          <div className="glass rounded-lg p-12 text-center space-y-4">
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Loading Repository</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Fetching repository data and files for dead code analysis...
              </p>
            </div>
          </div>
        ) : error && !repository ? (
          <div className="glass rounded-lg p-12 text-center space-y-4 animate-fade-in-up">
            <div className="flex justify-center">
              <Activity className="h-12 w-12 text-red-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-red-500">
                Failed to Load Repository
              </h3>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <button
              onClick={() => fetchRepository()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 transition-all duration-300 text-sm font-medium shadow-lg shadow-primary/25"
            >
              Retry Loading
            </button>
          </div>
        ) : !files.length ? (
          <div className="text-center py-12 flex flex-col items-center gap-4 animate-fade-in-up">
            <BarChart3 className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <h3 className="font-semibold text-lg">No files available</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Repository files have not been loaded yet. Run an analysis first.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push(`/repo/${id}`)}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-300 text-sm font-medium"
              >
                Back to Repository
              </button>
              <button
                onClick={handleReanalyze}
                disabled={analyzing}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 transition-all duration-300 text-sm font-medium disabled:opacity-50"
              >
                {analyzing ? "Analyzing..." : "Analyze Repository"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 animate-fade-in-up">
              <Link
                href={`/repo/${id}`}
                className="glass p-2 rounded-lg hover:bg-white/10 transition-all duration-300 self-start"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Link>

              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold truncate flex items-center gap-3">
                  <FileX2 className="h-6 w-6 text-rose-500" />
                  Dead Code Analysis
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {repository?.name || "Repository"} —{" "}
                  {findings.length} finding{findings.length !== 1 ? "s" : ""} across{" "}
                  {files.length} file{files.length !== 1 ? "s" : ""}
                </p>
              </div>

              <button
                onClick={handleReanalyze}
                disabled={analyzing}
                className="glass p-2 rounded-lg hover:bg-white/10 transition-all duration-300 disabled:opacity-50"
                title="Re-analyze repository"
              >
                <RefreshCw
                  className={`h-4 w-4 sm:h-5 sm:w-5 ${analyzing ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            <DeadCodePanel files={files} findings={findings} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
