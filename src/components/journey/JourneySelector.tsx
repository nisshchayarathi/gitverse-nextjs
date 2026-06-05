"use client";

import { useState } from "react";
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui";
import { BookOpen, Target, Clock } from "lucide-react";

// Client-side code must not import server-only packages like `@prisma/client`.
// Define a local ComplexityLevel type for UI use.
export type ComplexityLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";

interface JourneySelectorProps {
  repositoryId: number;
  repositoryName: string;
  onGenerate: (config: JourneyConfig) => Promise<void>;
  isLoading?: boolean;
}

export interface JourneyConfig {
  moduleName: string;
  goalDescription: string;
  targetComplexity: ComplexityLevel;
  maxSteps?: number;
}

export function JourneySelector({
  repositoryName,
  onGenerate,
  isLoading,
}: JourneySelectorProps) {
  const [moduleName, setModuleName] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [targetComplexity, setTargetComplexity] = useState<ComplexityLevel>("INTERMEDIATE");
  const [maxSteps, setMaxSteps] = useState("10");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!moduleName.trim() || !goalDescription.trim()) {
      alert("Please fill in all fields");
      return;
    }

    try {
      await onGenerate({
        moduleName: moduleName.trim(),
        goalDescription: goalDescription.trim(),
        targetComplexity,
        maxSteps: parseInt(maxSteps),
      });
    } catch (error) {
      console.error("Error generating journey:", error);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5" />
          Create Your Learning Journey
        </CardTitle>
        <CardDescription>
          For repository: <span className="font-semibold">{repositoryName}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Module/Goal Name</label>
            <Input
              placeholder="e.g., Authentication System, UI Components, API Integration"
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500">
              Give your learning path a clear, descriptive name
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">What do you want to learn?</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., I want to understand how authentication is implemented and secure user sessions"
              rows={3}
              value={goalDescription}
              onChange={(e) => setGoalDescription(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500">
              Be as specific as possible about your learning goal
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium">Experience Level</label>
              <select
                value={targetComplexity}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setTargetComplexity(e.target.value as ComplexityLevel)
                }
                disabled={isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
                <option value="EXPERT">Expert</option>
              </select>
              <p className="text-xs text-gray-500">
                Affects file selection and ordering
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Max Steps
              </label>
              <Input
                type="number"
                min="3"
                max="20"
                value={maxSteps}
                onChange={(e) => setMaxSteps(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500">
                Number of files to learn
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-2">
              <BookOpen className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">How it works:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>We'll analyze the codebase to find relevant files</li>
                  <li>Files are ranked by importance and dependency graph</li>
                  <li>You'll get a personalized learning sequence</li>
                  <li>Track your progress as you learn each step</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={isLoading || !moduleName.trim() || !goalDescription.trim()}
              className="flex-1"
            >
              {isLoading ? "Generating..." : "Generate Journey"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
