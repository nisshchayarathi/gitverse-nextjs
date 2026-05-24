"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Check,
  Loader2,
  AlertTriangle,
  RefreshCw,
  LayoutDashboard,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getFriendlyErrorMessage } from "@/utils/error";
import { cn } from "@/lib/utils";

interface ProgressStage {
  id: string;
  label: string;
  description: string;
  minPercent: number;
  maxPercent: number;
}

const STAGES: ProgressStage[] = [
  {
    id: "metadata",
    label: "Fetching repository metadata",
    description: "Downloading repository structure, branch list, and git files.",
    minPercent: 0,
    maxPercent: 15,
  },
  {
    id: "parsing",
    label: "Parsing repository structure",
    description: "Scanning folder hierarchy and analyzing file content.",
    minPercent: 16,
    maxPercent: 65,
  },
  {
    id: "dependencies",
    label: "Analyzing dependencies & contributors",
    description: "Processing code statistics and developer contributions.",
    minPercent: 66,
    maxPercent: 80,
  },
  {
    id: "insights",
    label: "Generating AI onboarding insights",
    description: "Deriving repository summaries and setup roadmaps.",
    minPercent: 81,
    maxPercent: 90,
  },
  {
    id: "architecture",
    label: "Building architecture map",
    description: "Visualizing layout connections and file trees.",
    minPercent: 91,
    maxPercent: 98,
  },
  {
    id: "finalizing",
    label: "Finalizing results",
    description: "Saving indexed data and loading dashboards.",
    minPercent: 99,
    maxPercent: 100,
  },
];

interface AnalysisProgressProps {
  progressPercent: number;
  progressMessage?: string;
  status: "pending" | "analyzing" | "completed" | "failed" | string;
  error?: string;
  onRetry?: () => void;
  onCancel?: () => void;
}

export const AnalysisProgress: React.FC<AnalysisProgressProps> = ({
  progressPercent,
  progressMessage = "Preparing analysis...",
  status,
  error,
  onRetry,
  onCancel,
}) => {
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isStuck, setIsStuck] = useState(false);
  const lastProgressRef = useRef(progressPercent);
  const lastChangeTimeRef = useRef(Date.now());

  // Track progress updates to detect stuck states
  useEffect(() => {
    if (progressPercent !== lastProgressRef.current) {
      lastProgressRef.current = progressPercent;
      lastChangeTimeRef.current = Date.now();
      setIsStuck(false);
    }
  }, [progressPercent]);

  // Monitor analysis duration and inactivity
  useEffect(() => {
    if (status !== "analyzing" && status !== "pending") return;

    const timer = setInterval(() => {
      setTimeElapsed((prev) => prev + 1);

      const msSinceLastChange = Date.now() - lastChangeTimeRef.current;
      // If progress hasn't changed for 20 seconds, or overall time > 60 seconds
      if (msSinceLastChange > 20000 || timeElapsed > 60) {
        setIsStuck(true);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [status, timeElapsed]);

  const currentPercent = Math.min(100, Math.max(0, progressPercent));
  const isFailed = status.toLowerCase() === "failed" || status.toLowerCase() === "error";

  if (isFailed) {
    return (
      <Card className="glass border border-destructive/20 max-w-xl mx-auto shadow-2xl overflow-hidden animate-fade-in-up">
        <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
          <div className="p-4 rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-10 w-10 animate-bounce" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Analysis Failed</h2>
            <p className="text-muted-foreground text-sm max-w-md">
              {getFriendlyErrorMessage(error || "The repository analysis job encountered an error.")}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {onRetry && (
              <Button
                onClick={onRetry}
                variant="default"
                className="bg-gradient-primary hover:opacity-90 flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Retry Analysis</span>
              </Button>
            )}
            {onCancel && (
              <Button
                onClick={onCancel}
                variant="outline"
                className="hover:bg-white/10 flex items-center justify-center gap-2"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Go to Dashboard</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up">
      {/* Main Status Card */}
      <Card className="glass shadow-2xl relative overflow-hidden border border-white/5 glow-primary">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-white/5">
          <div
            className="bg-gradient-to-r from-primary via-purple-500 to-accent h-full transition-all duration-500 ease-out"
            style={{ width: `${currentPercent}%` }}
          />
        </div>

        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-4">
            <div className="text-center sm:text-left space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold flex items-center justify-center sm:justify-start gap-2">
                <span>Analyzing Repository</span>
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground truncate max-w-xs sm:max-w-md">
                {progressMessage}
              </p>
            </div>
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 border border-primary/20 relative">
              <span className="text-base font-bold font-mono text-primary">{currentPercent}%</span>
              <div className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            </div>
          </div>

          {/* Glowing Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground font-mono">
              <span>Progress</span>
              <span>{currentPercent}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden relative">
              <div
                className="bg-gradient-to-r from-primary via-purple-500 to-accent h-full transition-all duration-500 ease-out"
                style={{ width: `${currentPercent}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Steps List */}
      <Card className="glass border border-white/5">
        <CardHeader className="p-4 sm:p-6 pb-2">
          <CardTitle className="text-sm font-semibold tracking-wider uppercase text-muted-foreground">
            Analysis Progress Stages
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          {STAGES.map((stage, index) => {
            const isCompleted = currentPercent > stage.maxPercent;
            const isActive = currentPercent >= stage.minPercent && currentPercent <= stage.maxPercent;

            return (
              <div
                key={stage.id}
                className={cn(
                  "flex items-start gap-4 p-3 rounded-lg border transition-all duration-300",
                  isActive
                    ? "border-primary/30 bg-primary/5 shadow-md shadow-primary/5 scale-[1.01]"
                    : "border-transparent opacity-60"
                )}
              >
                {/* Stage Icon/Indicator */}
                <div className="mt-0.5 flex-shrink-0">
                  {isCompleted ? (
                    <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="h-4 w-4" />
                    </div>
                  ) : isActive ? (
                    <div className="h-6 w-6 rounded-full bg-primary/20 border border-primary text-primary flex items-center justify-center relative">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    </div>
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-white/5 border border-white/10 text-muted-foreground flex items-center justify-center font-mono text-xs">
                      {index + 1}
                    </div>
                  )}
                </div>

                {/* Stage Info */}
                <div className="space-y-0.5 flex-1 min-w-0">
                  <h3
                    className={cn(
                      "text-sm font-medium tracking-tight transition-colors",
                      isActive ? "text-foreground font-semibold" : "text-muted-foreground"
                    )}
                  >
                    {stage.label}
                  </h3>
                  {isActive && (
                    <p className="text-xs text-muted-foreground animate-pulse">
                      {stage.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Stuck Alert / Long Analysis Fallback */}
      {isStuck && (
        <Card className="glass border border-yellow-500/20 bg-yellow-500/5 overflow-hidden animate-fade-in-up">
          <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500 flex-shrink-0">
              <AlertTriangle className="h-5 w-5 animate-pulse" />
            </div>
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">Taking longer than expected</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Large repositories or busy queue threads can extend processing time. The analysis will continue running automatically. You can safely go back to your dashboard and return later.
                </p>
              </div>
              {onCancel && (
                <Button
                  onClick={onCancel}
                  variant="outline"
                  size="sm"
                  className="hover:bg-white/10 text-xs flex items-center gap-1 mx-auto sm:mx-0"
                >
                  <span>Go to Dashboard</span>
                  <ChevronRight className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
