"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { AnalysisDetailSkeleton } from "@/components/analysis/AnalysisDetailSkeleton";
import { AnalysisFailureState } from "@/components/analysis/AnalysisFailureState";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { EmptyState } from "@/components/ui";
import { Activity } from "lucide-react";

export default function AnalysisJobPage() {
  const router = useRouter();
  const params = useParams();

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(null);
    setError(null);

    if (!params?.jobId) {
      setLoading(false); // prevent skeleton from getting stuck
      return;
    }

    const controller = new AbortController();
    const token = localStorage.getItem("gitverse_token");

    fetch(`/api/analysis-jobs/${params.jobId}`, {
      signal: controller.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          const status = res.status;
          // Fix 2: never forward raw API error — use sanitized messages
          if (status === 401 || status === 403) {
            throw new Error("You do not have permission to view this analysis.");
          }
          if (status === 404) {
            throw new Error("This analysis could not be found.");
          }
          throw new Error("Failed to load analysis. Please try again.");
        }
        return res.json();
      })
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (e.name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setError(e.message);
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [params?.jobId]);

  if (loading) return <AnalysisDetailSkeleton />;

  if (error) return <AnalysisFailureState message={error} />;

  return (
    <DashboardLayout>
      {data ? (
        <div className="p-6 max-w-4xl mx-auto w-full">
          <h1 className="text-2xl font-bold mb-4">{data.title || "Analysis Job Details"}</h1>
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400 text-sm">Status</p>
                <p className="font-semibold">{data.status || "Unknown"}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Repository</p>
                <p className="font-semibold">{data.repository || "Unknown"}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Created At</p>
                <p className="font-semibold">{data.createdAt ? new Date(data.createdAt).toLocaleString() : "Unknown"}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-2">Raw Data</h2>
            <pre className="overflow-auto text-xs text-gray-300">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center min-h-[60vh]">
          <EmptyState
            icon={Activity}
            title="No Analysis Jobs Found"
            description="You haven't created any analysis jobs yet."
            actionLabel="Create New Job"
            onAction={() => router.push("/analyze")}
          />
        </div>
      )}
    </DashboardLayout>
  );
}
