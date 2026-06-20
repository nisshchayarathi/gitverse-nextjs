"use client";

import { useState } from "react";
import {
  Brain,
  BookOpen,
  Package,
  Code,
  GitBranch,
  Sparkles,
  Loader2,
} from "lucide-react";

const learningSteps = [
  {
    icon: BookOpen,
    title: "Read README.md",
    description:
      "Understand the project purpose, installation steps, and overall architecture.",
  },
  {
    icon: Package,
    title: "Explore Dependencies",
    description:
      "Check package.json to understand libraries, scripts, and project setup.",
  },
  {
    icon: Code,
    title: "Study Components & Modules",
    description:
      "Explore important folders, reusable components, and application structure.",
  },
  {
    icon: GitBranch,
    title: "Make Your First Contribution",
    description:
      "Start with documentation improvements, UI fixes, or beginner-friendly issues.",
  },
];

export default function RepositoryLearningPath() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPath, setShowPath] = useState(false);

  const generatePath = () => {
    setIsGenerating(true);

    setTimeout(() => {
      setIsGenerating(false);
      setShowPath(true);
    }, 1500);
  };

  return (
    <div className="rounded-xl border p-6 shadow-sm bg-background">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-purple-500" />
          <h2 className="text-xl font-semibold">
            AI Repository Learning Path
          </h2>
        </div>

        <button
          onClick={generatePath}
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
              Generate Path
            </>
          )}
        </button>
      </div>

      {!showPath && !isGenerating && (
        <p className="text-sm text-muted-foreground">
          Generate a personalized roadmap to understand this repository,
          discover important files, and find your first contribution.
        </p>
      )}

      {showPath && (
        <div className="space-y-4">
          {learningSteps.map((step, index) => {
            const Icon = step.icon;

            return (
              <div
                key={step.title}
                className="flex gap-4 rounded-lg border p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-5 w-5" />
                </div>

                <div>
                  <h3 className="font-medium">
                    Step {index + 1}: {step.title}
                  </h3>

                  <p className="text-sm text-muted-foreground">
                    {step.description}
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