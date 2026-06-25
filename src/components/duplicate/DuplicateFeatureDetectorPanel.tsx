"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from "@/components/ui";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { DuplicateFeature } from "@/lib/services/duplicateFeatureDetector";

export default function DuplicateFeatureDetectorPanel() {
  const [features, setFeatures] = useState<DuplicateFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("");

  const loadFeatures = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/analysis/duplicate-features", { signal });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load duplicate features");
      }

      setFeatures(data.features || []);
    } catch (err) {
      if ((err as any)?.name === "AbortError") return;
      setError(String(err));
      setFeatures([]);
      console.error("Duplicate feature detector error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadFeatures(controller.signal);
    return () => controller.abort();
  }, [loadFeatures]);

  const filtered = useMemo(
    () =>
      features
        .filter((feature) => {
          if (!filter) return true;
          const query = filter.toLowerCase();
          return (
            feature.category.toLowerCase().includes(query) ||
            feature.featureName.toLowerCase().includes(query) ||
            feature.files.some((file) => file.toLowerCase().includes(query))
          );
        })
        .sort((a, b) => b.confidence - a.confidence),
    [features, filter]
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span>Duplicate Features</span>
            {features.length ? <span className="text-sm text-gray-500">({features.length})</span> : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Filter by category, name, or file"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <Button onClick={() => loadFeatures()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {loading && <div className="text-sm text-gray-500">Scanning repository…</div>}
        {error && <div className="text-sm text-rose-400">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-sm text-gray-500">No duplicate features found.</div>
        )}

        <div className="space-y-4 mt-4">
          {filtered.map((feature) => (
            <div key={feature.id} className="border rounded-md p-3 bg-white/5 dark:bg-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <div
                      className={`px-2 py-1 rounded text-sm font-medium ${
                        feature.confidence >= 90
                          ? "bg-green-600 text-white"
                          : feature.confidence >= 70
                          ? "bg-yellow-500 text-black"
                          : "bg-gray-500 text-white"
                      }`}
                    >
                      {feature.confidence}%
                    </div>
                    <div className="font-semibold truncate">{feature.featureName}</div>
                    <div className="text-xs text-gray-400">{feature.category}</div>
                  </div>
                  <div className="text-sm text-gray-400 mt-2">
                    {feature.files.slice(0, 5).map((file) => (
                      <span key={file} className="inline-block mr-2">
                        - {file}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setExpanded((current) => ({
                        ...current,
                        [feature.id]: !current[feature.id],
                      }))
                    }
                    aria-expanded={!!expanded[feature.id]}
                  >
                    {expanded[feature.id] ? <ChevronUp /> : <ChevronDown />}
                  </Button>
                </div>
              </div>

              {expanded[feature.id] && (
                <div className="mt-3 text-sm text-gray-300">
                  <div className="mb-2">
                    <strong>Recommendation:</strong> {feature.recommendation}
                  </div>
                  <div className="mb-2">
                    <strong>Affected files:</strong>
                    <ul className="list-disc list-inside ml-4 mt-1">
                      {feature.files.map((file) => (
                        <li key={`${feature.id}-${file}`}>{file}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <strong>Examples:</strong>
                    <div className="mt-2 space-y-2">
                      {feature.examples.map((example) => (
                        <div
                          key={`${feature.id}-${example.file}-${example.symbol}`}
                          className="p-2 bg-black/5 rounded"
                        >
                          <div className="text-xs text-gray-400">
                            {example.file} — {example.symbol}
                          </div>
                          <pre className="text-xs whitespace-pre-wrap max-h-40 overflow-auto mt-1">
                            {example.snippet}
                          </pre>
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
