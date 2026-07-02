"use client";

import { useState } from "react";
import {
  GitPullRequest,
  Sparkles,
  Loader2,
  CheckCircle,
  AlertTriangle,
  FileCode,
  BookOpen,
} from "lucide-react";

const reviewSuggestions = [
  {
    icon: CheckCircle,
    title: "Code Quality",
    status: "Excellent",
    description:
      "Code follows good practices with proper structure and readability.",
    color: "text-green-500",
  },
  {
    icon: AlertTriangle,
    title: "Potential Issues",
    status: "Needs Attention",
    description:
      "Some functions can be simplified and additional error handling is recommended.",
    color: "text-yellow-500",
  },
  {
    icon: FileCode,
    title: "Coding Style",
    status: "Consistent",
    description:
      "Naming conventions and formatting match the project standards.",
    color: "text-blue-500",
  },
  {
    icon: BookOpen,
    title: "Documentation",
    status: "Improve",
    description:
      "Add more comments and update documentation for newly added modules.",
    color: "text-purple-500",
  },
];

export default function PullRequestReviewAssistant() {
  const [isReviewing, setIsReviewing] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const generateReview = () => {
    setIsReviewing(true);

    setTimeout(() => {
      setIsReviewing(false);
      setShowReview(true);
    }, 1500);
  };

  return (
    <div className="rounded-xl border p-6 shadow-sm bg-background">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <GitPullRequest className="h-6 w-6 text-blue-500" />
          <h2 className="text-xl font-semibold">
            AI Pull Request Review Assistant
          </h2>
        </div>

        <button
          onClick={generateReview}
          disabled={isReviewing}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition"
        >
          {isReviewing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Reviewing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Analyze PR
            </>
          )}
        </button>
      </div>

      {!showReview && !isReviewing && (
        <p className="text-sm text-muted-foreground">
          Analyze pull request changes for quality, readability,
          possible issues, documentation, and coding standards.
        </p>
      )}

      {showReview && (
        <div className="space-y-4">
          {/* PR Quality Score */}
          <div className="rounded-lg border p-4 bg-primary/5">
            <h3 className="font-semibold">
              PR Quality Score: 92/100
            </h3>
            <p className="text-sm text-muted-foreground">
              This pull request follows most best practices with a few areas for improvement.
            </p>
          </div>

          {/* Review Suggestions */}
          {reviewSuggestions.map((item, index) => {
            const Icon = item.icon;

            return (
              <div key={index} className="rounded-lg border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-5 w-5 ${item.color}`} />
                  <h3 className="font-medium">
                    {item.title}
                  </h3>
                </div>

                <p className={`text-sm font-medium ${item.color}`}>
                  {item.status}
                </p>

                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}