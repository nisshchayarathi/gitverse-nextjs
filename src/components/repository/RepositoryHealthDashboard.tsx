"use client";

import { useState } from "react";
import {
  HeartPulse,
  Activity,
  GitCommit,
  GitPullRequest,
  Bug,
  Package,
  Loader2,
  Sparkles,
} from "lucide-react";

const healthMetrics = [
  {
    icon: GitCommit,
    title: "Commit Activity",
    status: "Excellent",
    value: "250 commits this month",
    color: "text-green-500",
  },
  {
    icon: Bug,
    title: "Open Issues",
    status: "Moderate",
    value: "12 active issues",
    color: "text-yellow-500",
  },
  {
    icon: GitPullRequest,
    title: "Pull Requests",
    status: "Healthy",
    value: "8 PRs under review",
    color: "text-blue-500",
  },
  {
    icon: Package,
    title: "Dependencies",
    status: "Updated",
    value: "95% packages secure",
    color: "text-green-500",
  },
];

export default function RepositoryHealthDashboard() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  const generateHealthReport = () => {
    setIsAnalyzing(true);

    setTimeout(() => {
      setIsAnalyzing(false);
      setShowDashboard(true);
    }, 1500);
  };

  return (
    <div className="rounded-xl border p-6 shadow-sm bg-background">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-6 w-6 text-red-500" />
          <h2 className="text-xl font-semibold">
            Smart Repository Health Dashboard
          </h2>
        </div>

        <button
          onClick={generateHealthReport}
          disabled={isAnalyzing}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Report
            </>
          )}
        </button>
      </div>

      {!showDashboard && !isAnalyzing && (
        <p className="text-sm text-muted-foreground">
          Analyze repository activity, maintenance, dependencies, and overall project health.
        </p>
      )}

      {showDashboard && (
        <div className="space-y-4">
          {/* Overall Health Score */}
          <div className="rounded-lg border p-4 bg-primary/5 flex items-center gap-3">
            <Activity className="h-6 w-6 text-green-500" />
            <div>
              <h3 className="font-semibold">
                Overall Repository Health: 88/100
              </h3>
              <p className="text-sm text-muted-foreground">
                The repository is actively maintained and in good condition.
              </p>
            </div>
          </div>

          {/* Health Metrics */}
          {healthMetrics.map((metric, index) => {
            const Icon = metric.icon;

            return (
              <div
                key={index}
                className="flex gap-4 rounded-lg border p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Icon className={`h-5 w-5 ${metric.color}`} />
                </div>

                <div>
                  <h3 className="font-medium">
                    {metric.title}
                  </h3>

                  <p className={`text-sm font-medium ${metric.color}`}>
                    {metric.status}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {metric.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}