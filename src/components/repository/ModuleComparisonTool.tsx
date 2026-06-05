"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, EmptyState, Button } from "@/components/ui";
import { ModuleSelector } from "./ModuleSelector";
import { ModuleComparisonCard } from "./ModuleComparisonCard";
import { getModuleMetadata } from "@/config/moduleMetadata";
import { X, GitCompare } from "lucide-react";

export function ModuleComparisonTool() {
  const [moduleOne, setModuleOne] = useState<string | null>(null);
  const [moduleTwo, setModuleTwo] = useState<string | null>(null);

  const metadataOne = moduleOne ? getModuleMetadata(moduleOne) : null;
  const metadataTwo = moduleTwo ? getModuleMetadata(moduleTwo) : null;

  const hasComparison = metadataOne && metadataTwo;

  const handleClear = () => {
    setModuleOne(null);
    setModuleTwo(null);
  };

  return (
    <Card className="glass border border-border/70 transition-all duration-300">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg">🔍 Module Comparison Tool</CardTitle>
            <CardDescription>
              Compare two modules to understand their roles and complexity
            </CardDescription>
          </div>
          {hasComparison && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="px-3 py-1 h-auto text-xs hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Module Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ModuleSelector
            value={moduleOne}
            onChange={setModuleOne}
            placeholder="Select first module..."
            excludeModule={moduleTwo || undefined}
            label="Module 1"
          />
          <ModuleSelector
            value={moduleTwo}
            onChange={setModuleTwo}
            placeholder="Select second module..."
            excludeModule={moduleOne || undefined}
            label="Module 2"
          />
        </div>

        {/* Comparison Display */}
        {hasComparison ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <ModuleComparisonCard module={metadataOne} />
            <ModuleComparisonCard module={metadataTwo} />

            {/* Differences Highlight */}
            <div className="lg:col-span-2">
              <div className="rounded-lg border border-border/40 bg-muted/20 p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">
                  📊 Key Differences
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {metadataOne.complexity !== metadataTwo.complexity && (
                    <div className="rounded-md bg-background/50 border border-border/30 p-2 text-xs space-y-1">
                      <p className="font-medium text-foreground">Complexity</p>
                      <p className="text-muted-foreground">
                        <span className="text-foreground font-semibold">
                          {metadataOne.name}
                        </span>{" "}
                        has <strong>{metadataOne.complexity}</strong> complexity,
                        while{" "}
                        <span className="text-foreground font-semibold">
                          {metadataTwo.name}
                        </span>{" "}
                        has <strong>{metadataTwo.complexity}</strong>.
                      </p>
                    </div>
                  )}

                  {metadataOne.importance !== metadataTwo.importance && (
                    <div className="rounded-md bg-background/50 border border-border/30 p-2 text-xs space-y-1">
                      <p className="font-medium text-foreground">Importance</p>
                      <p className="text-muted-foreground">
                        <span className="text-foreground font-semibold">
                          {metadataOne.name}
                        </span>{" "}
                        is marked as{" "}
                        <strong>{metadataOne.importance}</strong>, while{" "}
                        <span className="text-foreground font-semibold">
                          {metadataTwo.name}
                        </span>{" "}
                        is marked as <strong>{metadataTwo.importance}</strong>.
                      </p>
                    </div>
                  )}

                  {JSON.stringify(metadataOne.recommendedFor) !==
                    JSON.stringify(metadataTwo.recommendedFor) && (
                    <div className="rounded-md bg-background/50 border border-border/30 p-2 text-xs space-y-1">
                      <p className="font-medium text-foreground">
                        Recommended For
                      </p>
                      <p className="text-muted-foreground">
                        <span className="text-foreground font-semibold">
                          {metadataOne.name}
                        </span>{" "}
                        is better for{" "}
                        <strong>
                          {metadataOne.recommendedFor.join(", ")}
                        </strong>{" "}
                        contributors.
                      </p>
                    </div>
                  )}

                  {metadataOne.purpose !== metadataTwo.purpose && (
                    <div className="rounded-md bg-background/50 border border-border/30 p-2 text-xs space-y-1">
                      <p className="font-medium text-foreground">Purpose</p>
                      <p className="text-muted-foreground">
                        Each module serves a distinct purpose in the
                        architecture.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={GitCompare}
            title="Select two modules to compare"
            description="Choose two different modules to see their purpose, complexity, and how they differ in your repository architecture."
          />
        )}
      </CardContent>
    </Card>
  );
}
