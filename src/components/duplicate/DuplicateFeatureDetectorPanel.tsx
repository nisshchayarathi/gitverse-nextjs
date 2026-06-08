"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from "@/components/ui";
import { ChevronDown, ChevronUp } from "lucide-react";

export type DuplicateFeature = {
  featureName: string;
  confidence: number;
  files: string[];
  recommendation: string;
  category: string;
  examples: Array<{ file: string; symbol: string; snippet?: string }>;
};

export default function DuplicateFeatureDetectorPanel() {
  const [features, setFeatures] = useState<DuplicateFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/analysis/duplicate-features");
        const data = await res.json();
        if (data?.ok) setFeatures(data.features || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    return features
      .filter((f) => (filter ? f.category.includes(filter) || f.featureName.toLowerCase().includes(filter.toLowerCase()) : true))
      .sort((a, b) => b.confidence - a.confidence);
  }, [features, filter]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-3">Duplicate Features <span className="text-sm text-gray-500">{features.length ? `(${features.length})` : ""}</span></span>
          <div className="flex items-center gap-2">
            <Input placeholder="Filter by category or name" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <Button onClick={() => { setFilter(""); setFeatures([]); setLoading(true); setTimeout(() => window.location.reload(), 50); }}>
              Refresh
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {loading && <div className="text-sm text-gray-500">Scanning repository…</div>}
        {!loading && filtered.length === 0 && <div className="text-sm text-gray-500">No duplicate features found.</div>}

        <div className="space-y-4 mt-4">
          {filtered.map((f) => (
            <div key={f.featureName + f.files.join(",")} className="border rounded-md p-3 bg-white/5 dark:bg-slate-800">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <div className={`px-2 py-1 rounded text-sm font-medium ${f.confidence >= 90 ? "bg-green-600 text-white" : f.confidence >= 70 ? "bg-yellow-500 text-black" : "bg-gray-500 text-white"}`}>
                      {f.confidence}%
                    </div>
                    <div className="font-semibold">{f.featureName}</div>
                    <div className="text-xs text-gray-400">{f.category}</div>
                  </div>
                  <div className="text-sm text-gray-400 mt-2">{f.files.slice(0, 5).map((x) => <span key={x} className="inline-block mr-2">- {x}</span>)}</div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => setExpanded((s) => ({ ...s, [f.featureName]: !s[f.featureName] }))} aria-expanded={!!expanded[f.featureName]}>
                    {expanded[f.featureName] ? <ChevronUp /> : <ChevronDown />}
                  </Button>
                </div>
              </div>

              {expanded[f.featureName] && (
                <div className="mt-3 text-sm text-gray-300">
                  <div className="mb-2"><strong>Recommendation:</strong> {f.recommendation}</div>
                  <div className="mb-2"><strong>Affected files:</strong>
                    <ul className="list-disc list-inside ml-4 mt-1">
                      {f.files.map((file) => <li key={file}>{file}</li>)}
                    </ul>
                  </div>
                  <div>
                    <strong>Examples:</strong>
                    <div className="mt-2 space-y-2">
                      {f.examples.map((ex, i) => (
                        <div key={i} className="p-2 bg-black/5 rounded">
                          <div className="text-xs text-gray-400">{ex.file} — {ex.symbol}</div>
                          <pre className="text-xs whitespace-pre-wrap max-h-40 overflow-auto mt-1">{ex.snippet}</pre>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
