"use client";

import { useEffect, useState } from "react";
import axios from "axios";

interface DriftReport {
  id: number;
  driftScore: number;
  createdAt: string;
}

export default function ArchitectureDriftWidget({ repositoryId }: { repositoryId?: number }) {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<DriftReport[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, [repositoryId]);

  async function fetchReports() {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (repositoryId) params.repositoryId = repositoryId;
      const res = await axios.get(`/api/architecture-drift/compare?repositoryId=${params.repositoryId || ""}`);
      if (res.data.ok) {
        const rec = res.data.rec || res.data.rec;
        // If compare returned single rec, show that and recent reports
        const reportsResp = res.data.reports || (res.data.rec ? [res.data.rec] : []);
        setReports(reportsResp.map((r: any) => ({ id: r.id, driftScore: r.driftScore || r.driftScore, createdAt: r.createdAt || new Date().toISOString() })));
      } else {
        setError(res.data.error || "Failed to load");
      }
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 bg-white border rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Architecture Drift</h3>
        <button className="text-xs text-blue-600" onClick={fetchReports} disabled={loading}>
          {loading ? "Checking..." : "Refresh"}
        </button>
      </div>

      {error && <div className="text-xs text-red-600">{error}</div>}

      {!loading && reports.length === 0 && <div className="text-xs text-gray-500">No drift reports yet.</div>}

      <div className="space-y-2">
        {reports.map((r) => (
          <div key={r.id} className="flex items-center justify-between p-2 border rounded">
            <div className="text-sm font-mono truncate">{new Date(r.createdAt).toLocaleString()}</div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-600">Score</div>
              <div className={`px-2 py-0.5 rounded text-white ${r.driftScore >= 70 ? 'bg-red-600' : r.driftScore >=40 ? 'bg-yellow-500' : 'bg-green-600'}`}>
                {r.driftScore}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
