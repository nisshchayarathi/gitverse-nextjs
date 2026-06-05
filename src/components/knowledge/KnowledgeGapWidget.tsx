"use client";

import { useEffect, useState } from "react";

interface FileGap {
  filePath: string;
  knowledgeGapScore: number;
  riskLevel: string;
  suggestions: string[];
}

export default function KnowledgeGapWidget() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FileGap[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge-gaps");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "analysis failed");
      setData(json.results.slice(0, 10).map((r: any) => ({ filePath: r.filePath, knowledgeGapScore: r.knowledgeGapScore, riskLevel: r.riskLevel, suggestions: r.suggestions })));
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="p-4 bg-white border rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Knowledge Gaps</h3>
        <button
          className="text-xs text-blue-600"
          onClick={fetchData}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {loading && <div className="text-xs text-gray-500">Analyzing repository...</div>}
      {error && <div className="text-xs text-red-600">Error: {error}</div>}

      {!loading && !error && (
        <div className="space-y-2">
          {data.length === 0 && <div className="text-xs text-gray-500">No gaps detected.</div>}
          {data.map((f) => (
            <div key={f.filePath} className="p-2 border rounded">
              <div className="flex items-center justify-between">
                <div className="text-sm font-mono truncate">{f.filePath}</div>
                <div className="text-xs">
                  <span className={`px-2 py-0.5 rounded text-white ${f.riskLevel === 'High' ? 'bg-red-600' : f.riskLevel === 'Medium' ? 'bg-yellow-500' : 'bg-green-600'}`}>
                    {f.riskLevel}
                  </span>
                </div>
              </div>
              <div className="text-xs text-gray-600 mt-1">Score: {f.knowledgeGapScore}</div>
              {f.suggestions && f.suggestions.length > 0 && (
                <ul className="mt-2 text-xs list-disc list-inside text-gray-700">
                  {f.suggestions.slice(0, 3).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
