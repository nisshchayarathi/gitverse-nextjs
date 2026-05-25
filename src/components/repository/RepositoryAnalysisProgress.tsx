"use client";

import { CheckCircle, Loader2, Circle } from "lucide-react";
import { motion } from "framer-motion";

interface RepositoryAnalysisProgressProps {
  currentStep: number;
}

const steps = [
  {
    title: "Fetching repository metadata",
    description: "Loading repository information and branches",
  },
  {
    title: "Parsing repository structure",
    description: "Scanning folders and dependencies",
  },
  {
    title: "Generating AI insights",
    description: "Analyzing repository architecture",
  },
  {
    title: "Building architecture map",
    description: "Creating repository visualization",
  },
  {
    title: "Finalizing analysis results",
    description: "Preparing final dashboard",
  },
];

export default function RepositoryAnalysisProgress({
  currentStep,
}: RepositoryAnalysisProgressProps) {
  return (
    <div className="w-full max-w-2xl mx-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Repository Analysis in Progress
        </h2>

        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Please wait while GitVerse analyzes the repository.
        </p>
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
              transition={{ duration: 0.3 }}
              className="flex items-start gap-4"
            >
              <div className="mt-1">
                {isCompleted ? (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                ) : isActive ? (
                  <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                ) : (
                  <Circle className="h-6 w-6 text-slate-400" />
                )}
              </div>

              <div>
                <h3
                  className={`font-semibold ${
                    isCompleted || isActive
                      ? "text-slate-900 dark:text-white"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {step.title}
                </h3>

                <p
                  className={`text-sm mt-1 ${
                    isCompleted || isActive
                      ? "text-slate-500 dark:text-slate-400"
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
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
          <motion.div
            className="h-full bg-blue-600"
            initial={{ width: 0 }}
            animate={{
              width: `${((currentStep + 1) / steps.length) * 100}%`,
            }}
            transition={{ duration: 0.5 }}
          />
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
          Estimated time: 10–30 seconds
        </p>
      </div>
    </div>
  );
}