"use client";

import { useEffect, useState } from "react";
import { Flame, Users, FileText, TrendingUp } from "lucide-react";

interface ActivityArea {
  areaPath: string;
  activityScore: number;
  commitCount: number;
  lastUpdatedAt: string;
  contributorCount: number;
  contributors: string[];
  filesChanged: number;
  additionsCount: number;
  deletionsCount: number;
}

export default function RecentlyActiveAreasWidget({ repositoryId }: { repositoryId?: number }) {
  const [loading, setLoading] = useState(true);
  const [areas, setAreas] = useState<ActivityArea[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repositoryId) {
      setLoading(false);
      return;
    }
    fetchAreas();
  }, [repositoryId]);

  async function fetchAreas() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/recently-active-areas?repositoryId=${repositoryId}`);
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "Failed to load areas");
        setAreas([]);
      } else {
        setAreas(json.areas || []);
      }
    } catch (e: any) {
      setError(String(e));
      setAreas([]);
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="p-4 bg-white border rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          <h3 className="text-sm font-semibold">Recently Active Areas</h3>
        </div>
        <button
          className="text-xs text-blue-600 hover:text-blue-800"
          onClick={fetchAreas}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <div className="text-xs text-red-600 mb-3">{error}</div>}

      {!loading && areas.length === 0 && (
        <div className="text-xs text-gray-500">No activity data available.</div>
      )}

      {loading && <div className="text-xs text-gray-500">Loading activity...</div>}

      <div className="space-y-3">
        {areas.map((area) => (
          <div key={area.areaPath} className="p-3 border rounded-lg hover:bg-gray-50 transition">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-mono font-semibold text-gray-900 truncate">
                  {area.areaPath || "root"}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Updated {formatDate(area.lastUpdatedAt)}
                </div>
              </div>
              <div className={`px-2 py-1 rounded text-xs font-semibold text-white flex-shrink-0 ${
                area.activityScore >= 70
                  ? "bg-red-600"
                  : area.activityScore >= 40
                  ? "bg-orange-500"
                  : "bg-green-600"
              }`}>
                {Math.round(area.activityScore)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1 text-gray-600">
                <TrendingUp className="w-3 h-3" />
                <span>{area.commitCount} commits</span>
              </div>
              <div className="flex items-center gap-1 text-gray-600">
                <Users className="w-3 h-3" />
                <span>{area.contributorCount} contributors</span>
              </div>
              <div className="flex items-center gap-1 text-gray-600">
                <FileText className="w-3 h-3" />
                <span>{area.filesChanged} files changed</span>
              </div>
              <div className="text-gray-600">
                <span>+{area.additionsCount} -{area.deletionsCount}</span>
              </div>
            </div>

            {area.contributors.length > 0 && (
              <div className="mt-2 pt-2 border-t text-xs">
                <div className="text-gray-600 mb-1">Contributors:</div>
                <div className="flex flex-wrap gap-1">
                  {area.contributors.slice(0, 3).map((contrib, i) => (
                    <span key={i} className="px-2 py-0.5 bg-gray-100 rounded text-gray-700 truncate">
                      {contrib}
                    </span>
                  ))}
                  {area.contributors.length > 3 && (
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-700">
                      +{area.contributors.length - 3}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
