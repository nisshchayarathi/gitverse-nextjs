"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PublicSnapshotPage({
  params,
}: {
  params: { id: string; snapshotId: string };
}) {
  const [snapshot, setSnapshot] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSnapshot = async () => {
      try {
        const response = await fetch(
          `/api/public/repo/${params.id}/snapshot/${params.snapshotId}`
        );

        if (!response.ok) {
          if (response.status === 410) {
            setError("This snapshot has expired or been deleted.");
          } else {
            setError("Snapshot not found.");
          }
          return;
        }

        const data = await response.json();
        setSnapshot(data.snapshot);
      } catch (err) {
        setError("Failed to load snapshot.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSnapshot();
  }, [params.id, params.snapshotId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex items-center justify-center">
        <div className="text-white text-2xl">Loading snapshot...</div>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-2xl mx-auto bg-slate-800 rounded-lg p-8">
          <h1 className="text-3xl font-bold text-white mb-4">Error</h1>
          <p className="text-slate-300 mb-6">{error || "Snapshot not found."}</p>
          <Link href="/" className="text-blue-400 hover:text-blue-300 underline">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">
                🔒 Read-Only Snapshot
              </p>
              <p className="text-xs text-slate-400">Public analysis view</p>
            </div>
            
              href={snapshot.repository.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
            >
              View Repository
            </a>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-5xl font-bold text-white mb-2">
          {snapshot.repository.name}
        </h1>
        <p className="text-slate-300 mb-8">
          {snapshot.repository.description || "No description available"}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-white">
              {snapshot.repository.stars}
            </div>
            <div className="text-xs text-slate-400">Stars</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-white">
              {snapshot.commits.length}
            </div>
            <div className="text-xs text-slate-400">Commits</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-white">
              {snapshot.contributors.length}
            </div>
            <div className="text-xs text-slate-400">Contributors</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-white">
              {snapshot.repository.forks}
            </div>
            <div className="text-xs text-slate-400">Forks</div>
          </div>
        </div>

        {/* Languages */}
        {snapshot.languages.length > 0 && (
          <div className="bg-slate-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">
              Language Distribution
            </h2>
            <div className="space-y-3">
              {snapshot.languages.map((lang: any) => (
                <div key={lang.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{lang.name}</span>
                    <span className="text-slate-400">
                      {lang.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${lang.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA Banner */}
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/50 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-bold text-white mb-2">
            ⚡ Interested in Contributing?
          </h3>
          <p className="text-slate-300 mb-4">
            Get a complete analysis of any repository with GitVerse.
          </p>
          <Link
            href="/dashboard/repositories"
            className="inline-block px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
          >
            Analyze Your Repo
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 border-t border-slate-700 pt-8">
          <p>
            Powered by{" "}
            <a href="/" className="text-blue-400 hover:text-blue-300 underline">
              GitVerse
            </a>{" "}
            — Repository Analysis in 10 Seconds
          </p>
        </div>
      </div>
    </div>
  );
}