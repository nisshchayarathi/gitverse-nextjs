"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface PeriodStat {
  period: string;
  totalDeliveries: number;
  successRate: number;
  successCount: number;
  failedCount: number;
  processingCount: number;
}

interface StatusCounts {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  dlq: number;
  rate_limited: number;
}

interface RecentError {
  id: string;
  event: string;
  error: string | null;
  createdAt: string;
  deliveryId: string | null;
  retryCount: number;
  nextRetryAt: string | null;
}

interface HealthData {
  repoFullName: string;
  healthScore: number;
  periods: PeriodStat[];
  statusCounts: StatusCounts;
  recentErrors: RecentError[];
  totalDeliveries: number;
  successRate: number;
}

function HealthBadge({ score }: { score: number }) {
  const color = score >= 95 ? "bg-green-100 text-green-800 border-green-300" :
    score >= 80 ? "bg-yellow-100 text-yellow-800 border-yellow-300" :
    "bg-red-100 text-red-800 border-red-300";

  const label = score >= 95 ? "Healthy" : score >= 80 ? "Degraded" : "Unhealthy";

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${color}`}>
      <span className={`w-2 h-2 rounded-full ${score >= 95 ? "bg-green-500" : score >= 80 ? "bg-yellow-500" : "bg-red-500"}`} />
      {label} ({score}%)
    </span>
  );
}

export default function WebhookHealthPage() {
  const params = useParams();
  const repositoryId = params?.id as string;
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/repositories/${repositoryId}/webhook-health`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Failed to fetch webhook health");
      }
      const json = await response.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [repositoryId]);

  useEffect(() => {
    if (repositoryId) fetchHealth();
  }, [fetchHealth, repositoryId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Webhook Health</h1>
          <p className="text-gray-500 text-sm mt-1">{data.repoFullName}</p>
        </div>
        <HealthBadge score={data.healthScore} />
      </div>

      {/* Period breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {data.periods.map((p) => (
          <div key={p.period} className="bg-white border rounded-lg p-4">
            <div className="text-sm text-gray-500 font-medium mb-1">Last {p.period}</div>
            <div className="text-2xl font-bold mb-2">{p.totalDeliveries}</div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Success</span>
                <span className="font-medium text-green-600">{p.successCount} ({Math.round(p.successRate * 100)}%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Failed</span>
                <span className="font-medium text-red-600">{p.failedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Processing</span>
                <span className="font-medium text-yellow-600">{p.processingCount}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Status Breakdown</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {Object.entries(data.statusCounts).map(([status, count]) => (
            <div key={status} className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold capitalize">{count}</div>
              <div className="text-xs text-gray-500 capitalize">{status.replace("_", " ")}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent errors */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Recent Errors ({data.recentErrors.length})</h2>
        {data.recentErrors.length === 0 ? (
          <p className="text-gray-500 text-sm">No recent errors</p>
        ) : (
          <div className="space-y-2">
            {data.recentErrors.map((err) => (
              <div key={err.id} className="bg-red-50 border border-red-200 rounded p-3 text-sm">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-red-800">{err.event}</span>
                  <span className="text-xs text-gray-500">{new Date(err.createdAt).toLocaleString()}</span>
                </div>
                {err.error && <pre className="text-red-600 text-xs mt-1 whitespace-pre-wrap">{err.error}</pre>}
                <div className="flex gap-3 mt-1 text-xs text-gray-500">
                  <span>Retry {err.retryCount}/3</span>
                  {err.nextRetryAt && <span>Next retry: {new Date(err.nextRetryAt).toLocaleString()}</span>}
                  {err.deliveryId && <span>Delivery: {err.deliveryId}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
