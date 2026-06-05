"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui";
import {
  ModuleMetadata,
  getComplexityColor,
} from "@/config/moduleMetadata";

interface ModuleComparisonCardProps {
  module: ModuleMetadata;
  highlight?: boolean;
  className?: string;
}

export function ModuleComparisonCard({
  module,
  highlight = false,
  className = "",
}: ModuleComparisonCardProps) {
  const complexityColor = getComplexityColor(module.complexity);

  return (
    <Card
      className={`glass border border-border/70 transition-all duration-300 ${
        highlight
          ? "ring-2 ring-primary/50 shadow-lg"
          : "hover:shadow-md"
      } ${className}`}
    >
      <CardHeader>
        <CardTitle className="text-lg capitalize">{module.name}</CardTitle>
        <CardDescription className="line-clamp-2">
          {module.purpose}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Description */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">
            Description
          </p>
          <p className="text-sm text-foreground/80">{module.description}</p>
        </div>

        {/* Complexity Badge */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">
            Complexity
          </p>
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ring-1 ${complexityColor.bg} ${complexityColor.text} ${complexityColor.ring}`}
          >
            {module.complexity}
          </span>
        </div>

        {/* Importance */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">
            Importance
          </p>
          <p className="text-sm text-foreground/80">{module.importance}</p>
        </div>

        {/* Recommended For */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            Recommended For
          </p>
          <div className="flex flex-wrap gap-2">
            {module.recommendedFor.map((level) => (
              <span
                key={level}
                className="inline-block rounded-md border border-border/40 bg-muted/40 px-2 py-1 text-xs text-foreground/70"
              >
                {level}
              </span>
            ))}
          </div>
        </div>

        {/* Examples */}
        {module.examples && module.examples.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Examples
            </p>
            <ul className="space-y-1">
              {module.examples.map((example) => (
                <li
                  key={example}
                  className="text-xs text-foreground/70 flex items-start gap-2"
                >
                  <span className="text-accent mt-1">•</span>
                  <span>{example}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
