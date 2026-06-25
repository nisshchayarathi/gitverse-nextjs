"use client";

import { useState } from "react";
import {
  Bot,
  User,
  Send,
  Loader2,
  Sparkles,
  Folder,
  Code,
  Wrench,
} from "lucide-react";

const botResponses = [
  {
    icon: Folder,
    title: "Repository Structure",
    message:
      "Explore the src directory first, understand components, pages, and project architecture.",
  },
  {
    icon: Wrench,
    title: "Setup Guide",
    message:
      "Install dependencies, configure environment variables, and run the development server.",
  },
  {
    icon: Code,
    title: "Beginner Contributions",
    message:
      "Start with documentation updates, UI improvements, or small bug fixes before advanced features.",
  },
];

export default function ContributorOnboardingChatbot() {
  const [isThinking, setIsThinking] = useState(false);
  const [showMessages, setShowMessages] = useState(false);

  const askAssistant = () => {
    setIsThinking(true);

    setTimeout(() => {
      setIsThinking(false);
      setShowMessages(true);
    }, 1500);
  };

  return (
    <div className="rounded-xl border p-6 shadow-sm bg-background">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Bot className="h-6 w-6 text-blue-500" />
          <h2 className="text-xl font-semibold">
            AI Contributor Onboarding Chatbot
          </h2>
        </div>

        <button
          onClick={askAssistant}
          disabled={isThinking}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition"
        >
          {isThinking ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Ask AI Assistant
            </>
          )}
        </button>
      </div>

      {!showMessages && !isThinking && (
        <p className="text-sm text-muted-foreground">
          Ask the AI assistant to understand repository structure,
          setup steps, and beginner-friendly contribution areas.
        </p>
      )}

      {showMessages && (
        <div className="space-y-4">
          {botResponses.map((response, index) => {
            const Icon = response.icon;

            return (
              <div
                key={index}
                className="flex gap-4 rounded-lg border p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-5 w-5" />
                </div>

                <div>
                  <h3 className="font-medium">
                    {response.title}
                  </h3>

                  <p className="text-sm text-muted-foreground">
                    {response.message}
                  </p>
                </div>
              </div>
            );
          })}

          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
            <User className="h-4 w-4" />
            You can continue asking more repository-related questions in future AI updates.
          </div>
        </div>
      )}
    </div>
  );
}