"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui";
import { Info } from "lucide-react";

const QUESTIONS = [
  "Explain this module",
  "Where should beginners start?",
  "What files should I read first?",
  "Which areas are safe to modify?",
  "Explain the architecture",
] as const;

const QUESTION_HELPERS: Record<(typeof QUESTIONS)[number], string> = {
  "Explain this module":
    "Each module card includes a short description and recommendation so you can quickly understand its purpose.",
  "Where should beginners start?":
    "Start with beginner-friendly folders such as components, hooks, and utils. These areas are often a good first contribution path.",
  "What files should I read first?":
    "Look for shared components, top-level routing files, and service helpers. These files usually help you understand how the app fits together.",
  "Which areas are safe to modify?":
    "Beginner-friendly areas typically include UI components, small helpers, and documentation. Avoid authentication or cross-cutting services until you feel comfortable.",
  "Explain the architecture":
    "The architecture separates UI components, reusable hooks, data services, and utility helpers. This structure keeps the app easier to navigate and extend.",
};

export function BeginnerQuestionsPanel() {
  const [activeQuestion, setActiveQuestion] = useState<
    (typeof QUESTIONS)[number] | null
  >(null);

  return (
    <Card className="glass border border-border/70 transition-all duration-300">
      <CardHeader className="p-4">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Suggested Questions</CardTitle>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          Click a question to reveal quick guidance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0">
        <div className="flex flex-wrap gap-2">
          {QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => setActiveQuestion(question)}
              className={`rounded-full border px-3 py-2 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                activeQuestion === question
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-background text-foreground hover:border-primary hover:bg-primary/10"
              }`}
              aria-pressed={activeQuestion === question}
            >
              {question}
            </button>
          ))}
        </div>

        {activeQuestion ? (
          <div className="rounded-2xl border border-border/60 bg-background/80 p-4 text-sm leading-6 text-muted-foreground">
            <p className="font-semibold text-foreground mb-2">{activeQuestion}</p>
            <p>{QUESTION_HELPERS[activeQuestion]}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/50 bg-muted/10 p-4 text-sm text-muted-foreground">
            Select a question to get a guided explanation.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
