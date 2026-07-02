"use client";

import { useState } from "react";
import {
  Brain,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle,
  BarChart3,
} from "lucide-react";

const complexityData = [
  {
    file: "src/components/Dashboard.tsx",
    score: "Low",
    color: "text-green-500",
    icon: CheckCircle,
    suggestion: "Well structured and beginner-friendly for contributions.",
  },
  {
    file: "src/services/apiService.ts",
    score: "Medium",
    color: "text-yellow-500",
    icon: BarChart3,
    suggestion:
      "Consider splitting larger functions to improve maintainability.",
  },
  {
    file: "src/core/RepositoryEngine.ts",
    score: "High",
    color: "text-red-500",
    icon: AlertTriangle,
    suggestion:
      "Complex logic detected. Refactoring into smaller modules is recommended.",
  },
];

export default function CodeComplexityAnalyzer() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const analyzeComplexity = () => {
    setIsAnalyzing(true);

    setTimeout(() => {
      setIsAnalyzing(false);
      setShowAnalysis(true);
    }, 1500);
  };

  return (
    <div className="rounded-xl border p-6 shadow-sm bg-background">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-purple-500" />
          <h2 className="text-xl font-semibold">
            AI Code Complexity Analyzer
          </h2>
        </div>

        <button
          onClick={analyzeComplexity}
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
              Analyze Code
            </>
          )}
        </button>
      </div>

      {!showAnalysis && !isAnalyzing && (
        <p className="text-sm text-muted-foreground">
          Analyze repository files to detect complexity hotspots,
          maintainability concerns, and possible refactoring areas.
        </p>
      )}

      {showAnalysis && (
        <div className="space-y-4">
          {complexityData.map((item, index) => {
            const Icon = item.icon;

            return (
              <div
                key={index}
                className="rounded-lg border p-4 flex gap-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Icon className={`h-5 w-5 ${item.color}`} />
                </div>

                <div>
                  <h3 className="font-medium">
                    {item.file}
                  </h3>

                  <p className={`text-sm font-medium ${item.color}`}>
                    Complexity: {item.score}
                  </p>

                  <p className="text-sm text-muted-foreground mt-1">
                    {item.suggestion}
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