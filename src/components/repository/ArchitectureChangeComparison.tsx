"use client";

import { useState } from "react";
import {
  GitCompare,
  Plus,
  Edit,
  Trash2,
  BarChart3,
  Sparkles,
  Loader2,
} from "lucide-react";

const architectureChanges = [
  {
    icon: Plus,
    type: "Added Modules",
    color: "text-green-500",
    changes: [
      "src/components/AIAssistant.tsx",
      "src/services/analytics.ts",
    ],
  },
  {
    icon: Edit,
    type: "Modified Modules",
    color: "text-yellow-500",
    changes: [
      "src/components/Dashboard.tsx",
      "src/lib/repositoryParser.ts",
    ],
  },
  {
    icon: Trash2,
    type: "Removed Modules",
    color: "text-red-500",
    changes: [
      "src/utils/oldHelper.ts",
    ],
  },
];

export default function ArchitectureChangeComparison() {
  const [isComparing, setIsComparing] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const compareArchitecture = () => {
    setIsComparing(true);

    setTimeout(() => {
      setIsComparing(false);
      setShowResults(true);
    }, 1500);
  };

  return (
    <div className="rounded-xl border p-6 shadow-sm bg-background">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <GitCompare className="h-6 w-6 text-blue-500" />
          <h2 className="text-xl font-semibold">
            Repository Architecture Comparison
          </h2>
        </div>

        <button
          onClick={compareArchitecture}
          disabled={isComparing}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition"
        >
          {isComparing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Comparing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Compare Versions
            </>
          )}
        </button>
      </div>

      {!showResults && !isComparing && (
        <p className="text-sm text-muted-foreground">
          Compare two repository versions to understand architectural changes,
          module updates, and overall project evolution.
        </p>
      )}

      {showResults && (
        <div className="space-y-4">
          {/* Architecture Summary */}
          <div className="rounded-lg border p-4 bg-primary/5 flex gap-3">
            <BarChart3 className="h-6 w-6 text-blue-500" />
            <div>
              <h3 className="font-semibold">
                Architecture Growth Summary
              </h3>
              <p className="text-sm text-muted-foreground">
                Repository gained 2 new modules, modified 2 modules,
                and removed 1 deprecated module.
              </p>
            </div>
          </div>

          {architectureChanges.map((section, index) => {
            const Icon = section.icon;

            return (
              <div
                key={index}
                className="rounded-lg border p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-5 w-5 ${section.color}`} />
                  <h3 className="font-medium">
                    {section.type}
                  </h3>
                </div>

                <ul className="list-disc pl-6 text-sm text-muted-foreground">
                  {section.changes.map((change, idx) => (
                    <li key={idx}>
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}