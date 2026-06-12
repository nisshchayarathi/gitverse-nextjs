"use client";

import { CheckCircle, Loader2, Circle } from "lucide-react";
import { motion } from "framer-motion";

interface RepositoryAnalysisProgressProps {
  progressPercent: number;
  progressMessage?: string;
}

const steps = [
  {
    title: "Fetching repository metadata",
    description: "Loading repository information and cloning source files",
  },
  {
    title: "Parsing repository structure",
    description: "Scanning files, folder paths, and module imports",
  },
  {
    title: "Generating AI insights",
    description: "Analyzing files, package structures, and dependencies",
  },
  {
    title: "Building architecture map",
    description: "Creating D3 dependency node relationships",
  },
  {
    title: "Finalizing analysis results",
    description: "Saving structural insights and preparing dashboard",
  },
];

function getStepIndex(percent: number): number {
  if (percent < 10) return 0;
  if (percent < 40) return 1;
  if (percent < 70) return 2;
  if (percent < 95) return 3;
  return 4;
}

export default function RepositoryAnalysisProgress({
  progressPercent,
  progressMessage,
}: RepositoryAnalysisProgressProps) {
  const currentStep = getStepIndex(progressPercent);

  return (
    <div 
      className="w-full max-w-2xl mx-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-8 relative overflow-hidden"
      role="region" 
      aria-label="Repository analysis progress"
      aria-live="polite"
    >
      {/* Dynamic top glow decoration */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 dark:from-white dark:via-slate-100 dark:to-slate-200 bg-clip-text text-transparent">
            Repository Analysis in Progress
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm">
            Please wait while GitVerse maps and indexes your codebase.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-center px-3 py-1.5 rounded-full bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
            {progressPercent}%
          </span>
        </div>
      </div>

      <div className="space-y-5">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="flex items-start gap-4 group"
            >
              <div className="mt-1 relative flex items-center justify-center">
                {isCompleted ? (
                  <CheckCircle className="h-6 w-6 text-emerald-500 transition-transform duration-300 group-hover:scale-110" />
                ) : isActive ? (
                  <div className="relative h-6 w-6">
                    <Loader2 className="h-6 w-6 text-blue-500 animate-spin absolute inset-0" />
                    <span className="absolute inset-0 h-6 w-6 rounded-full bg-blue-500/10 animate-pulse" />
                  </div>
                ) : (
                  <Circle className="h-6 w-6 text-slate-350 dark:text-slate-700" />
                )}
              </div>

              <div className="flex-1">
                <h3
                  className={`font-semibold text-base transition-colors duration-200 ${
                    isCompleted
                      ? "text-slate-700 dark:text-slate-350"
                      : isActive
                      ? "text-slate-900 dark:text-white"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {step.title}
                </h3>

                <p
                  className={`text-sm mt-1 leading-relaxed transition-colors duration-200 ${
                    isCompleted || isActive
                      ? "text-slate-500 dark:text-slate-450"
                      : "text-slate-400 dark:text-slate-600"
                  }`}
                >
                  {step.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 mb-2 font-medium">
          <span className="truncate max-w-[70%]">
            {progressMessage ? `Status: ${progressMessage}` : "Analyzing..."}
          </span>
          <span className="tabular-nums">{progressPercent}% Completed</span>
        </div>
        
        <div 
          className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden p-[1px] border border-slate-200/30 dark:border-slate-700/30"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Overall analysis progress"
        >
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.4)]"
            initial={{ width: 0 }}
            animate={{
              width: `${progressPercent}%`,
            }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>

        <p className="text-xs text-slate-450 dark:text-slate-500 mt-3 flex items-center justify-between">
          <span>Connection: WebSockets (Real-time)</span>
          <span>Estimated time: 10–30 seconds</span>
        </p>
      </div>
    </div>
  );
}