"use client";

import { useState } from "react";
import {
  GitCommit,
  Users,
  Package,
  TrendingUp,
  Clock,
  Sparkles,
  Loader2,
} from "lucide-react";

const timelineEvents = [
  {
    icon: GitCommit,
    title: "Initial Repository Setup",
    date: "Project Start",
    description:
      "Core project structure, configuration files, and initial codebase were created.",
  },
  {
    icon: Package,
    title: "Major Module Expansion",
    date: "Feature Growth",
    description:
      "New components, services, and modules were introduced to extend functionality.",
  },
  {
    icon: Users,
    title: "Community Contributions",
    date: "Contributor Growth",
    description:
      "More developers joined and contributed improvements, fixes, and features.",
  },
  {
    icon: TrendingUp,
    title: "Repository Evolution",
    date: "Current Stage",
    description:
      "The repository continues to improve with better architecture, performance, and new capabilities.",
  },
];

export default function RepositoryEvolutionTimeline() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  const generateTimeline = () => {
    setIsGenerating(true);

    setTimeout(() => {
      setIsGenerating(false);
      setShowTimeline(true);
    }, 1500);
  };

  return (
    <div className="rounded-xl border p-6 shadow-sm bg-background">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Clock className="h-6 w-6 text-blue-500" />
          <h2 className="text-xl font-semibold">
            Repository Evolution Timeline
          </h2>
        </div>

        <button
          onClick={generateTimeline}
          disabled={isGenerating}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium border hover:bg-muted transition"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Timeline
            </>
          )}
        </button>
      </div>

      {!showTimeline && !isGenerating && (
        <p className="text-sm text-muted-foreground">
          Generate an interactive timeline to explore repository history,
          major changes, contributor growth, and project evolution.
        </p>
      )}

      {showTimeline && (
        <div className="space-y-4">
          {timelineEvents.map((event, index) => {
            const Icon = event.icon;

            return (
              <div
                key={index}
                className="flex gap-4 rounded-lg border p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    {event.date}
                  </p>

                  <h3 className="font-medium">
                    {event.title}
                  </h3>

                  <p className="text-sm text-muted-foreground">
                    {event.description}
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