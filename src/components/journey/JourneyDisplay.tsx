"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from "@/components/ui";
import { CheckCircle2, Circle, Clock, AlertCircle, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import type { ComplexityLevel, JourneyStatus } from "@prisma/client";

interface JourneyStep {
  id: number;
  filePath: string;
  fileName: string;
  complexity: ComplexityLevel;
  estimatedMinutes: number;
  reasoning: string;
  dependencies: string[];
  order: number;
  completed?: boolean;
  completedAt?: string;
}

interface JourneyDisplayProps {
  journeyId: number;
  moduleName: string;
  steps: JourneyStep[];
  progress: number;
  status: JourneyStatus;
  estimatedDays: number;
  onStepComplete: (stepId: number) => Promise<void>;
  isLoading?: boolean;
}

const ComplexityColors: Record<ComplexityLevel, string> = {
  BEGINNER: "bg-green-100 text-green-800",
  INTERMEDIATE: "bg-blue-100 text-blue-800",
  ADVANCED: "bg-orange-100 text-orange-800",
  EXPERT: "bg-red-100 text-red-800",
};

const ComplexityIcons: Record<ComplexityLevel, string> = {
  BEGINNER: "★",
  INTERMEDIATE: "★★",
  ADVANCED: "★★★",
  EXPERT: "★★★★",
};

export function JourneyDisplay({
  journeyId,
  moduleName,
  steps,
  progress,
  status,
  estimatedDays,
  onStepComplete,
  isLoading,
}: JourneyDisplayProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([0]));
  const [completingStepId, setCompletingStepId] = useState<number | null>(null);

  const toggleStep = (stepId: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const handleStepComplete = async (step: JourneyStep) => {
    try {
      setCompletingStepId(step.id);
      await onStepComplete(step.id);
    } finally {
      setCompletingStepId(null);
    }
  };

  const completedSteps = steps.filter((s) => s.completed).length;
  const totalMinutes = steps.reduce((sum, s) => sum + s.estimatedMinutes, 0);

  return (
    <div className="w-full space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            {moduleName}
          </CardTitle>
          <CardDescription>
            Journey Status: <span className="font-semibold capitalize">{status.replace(/_/g, " ")}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Overall Progress</span>
              <span className="text-gray-600">
                {completedSteps} / {steps.length} steps
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2"
                style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">Estimated Time</p>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span className="font-semibold">{totalMinutes} min</span>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">Estimated Days</p>
              <p className="font-semibold">{estimatedDays} days</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">Completion</p>
              <p className="font-semibold">{progress}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Steps */}
      <div className="space-y-3">
        <h3 className="font-semibold text-lg">Learning Steps</h3>
        {steps.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-gray-500 text-center py-8">No steps available</p>
            </CardContent>
          </Card>
        ) : (
          steps.map((step, index) => (
            <Card
              key={step.id}
              className={`cursor-pointer transition-all ${
                step.completed ? "bg-green-50 border-green-200" : ""
              }`}
              onClick={() => toggleStep(step.id)}
            >
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {/* Step Header */}
                  <div className="flex items-start gap-3 justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {step.completed ? (
                        <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-6 h-6 text-gray-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">
                            Step {index + 1}: {step.fileName}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${ComplexityColors[step.complexity]}`}>
                            {step.complexity}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">{step.filePath}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {step.estimatedMinutes}m
                      </span>
                      {expandedSteps.has(step.id) ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {expandedSteps.has(step.id) && (
                    <div className="pt-3 border-t space-y-3">
                      {/* Reasoning */}
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-1">Why learn this?</p>
                        <p className="text-sm text-gray-600">{step.reasoning}</p>
                      </div>

                      {/* Dependencies */}
                      {step.dependencies.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-700 mb-2">Dependencies</p>
                          <div className="space-y-1">
                            {step.dependencies.map((dep, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <AlertCircle className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                                <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700 break-all">
                                  {dep}
                                </code>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Button */}
                      {!step.completed && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStepComplete(step);
                          }}
                          disabled={isLoading || completingStepId === step.id}
                          className="w-full"
                          variant="default"
                        >
                          {completingStepId === step.id ? "Marking complete..." : "Mark as Complete"}
                        </Button>
                      )}
                      {step.completed && (
                        <div className="text-sm text-green-700 font-medium text-center py-2">
                          ✓ Completed
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
