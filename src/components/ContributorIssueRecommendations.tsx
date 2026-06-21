"use client";

import { useState } from "react";
import {
  Brain,
  Sparkles,
  Loader2,
  User,
  Code,
  Rocket,
  Clock,
} from "lucide-react";

const recommendedIssues = [
  {
    icon: User,
    level: "Beginner",
    title: "Improve Documentation",
    skills: "Markdown, GitHub",
    time: "1-2 hours",
    description:
      "Perfect for new contributors to understand the project structure and workflow.",
  },
  {
    icon: Code,
    level: "Intermediate",
    title: "Build a UI Enhancement",
    skills: "React, TypeScript, Tailwind CSS",
    time: "4-6 hours",
    description:
      "Suitable for developers with frontend experience who want to improve user experience.",
  },
  {
    icon: Rocket,
    level: "Advanced",
    title: "Develop a New Feature",
    skills: "System Design, APIs, Full Stack Development",
    time: "1-2 days",
    description:
      "Recommended for experienced contributors comfortable with complex repository changes.",
  },
];

export default function ContributorIssueRecommendations() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);

  const generateRecommendations = () => {
    setIsGenerating(true);

    setTimeout(() => {
      setIsGenerating(false);
      setShowRecommendations(true);
    }, 1500);
  };

  return (
    <div className="rounded-xl border p-6 shadow-sm bg-background">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-green-500" />
          <h2 className="text-xl font-semibold">
            AI Issue Recommendations
          </h2>
        </div>

        <button
          onClick={generateRecommendations}
          disabled={isGenerating}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Find Issues
            </>
          )}
        </button>
      </div>

      {!showRecommendations && !isGenerating && (
        <p className="text-sm text-muted-foreground">
          Generate personalized issue recommendations based on your skills,
          experience level, and contribution preferences.
        </p>
      )}

      {showRecommendations && (
        <div className="space-y-4">
          {recommendedIssues.map((issue, index) => {
            const Icon = issue.icon;

            return (
              <div
                key={index}
                className="rounded-lg border p-4 flex gap-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    {issue.level} • {issue.time}
                  </p>

                  <h3 className="font-medium">
                    {issue.title}
                  </h3>

                  <p className="text-sm text-muted-foreground mt-1">
                    {issue.description}
                  </p>

                  <p className="text-sm mt-2">
                    <span className="font-medium">
                      Skills:
                    </span>{" "}
                    {issue.skills}
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