"use client";

import { Button } from "@/components/ui/Button";

interface BeginnerModeToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

export function BeginnerModeToggle({ enabled, onToggle }: BeginnerModeToggleProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm transition-all duration-300 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <p className="text-sm font-semibold">Developer View</p>
        <p className="text-xs text-muted-foreground max-w-2xl">
          {enabled
            ? "Beginner Mode is active. You will now see guided module explanations, architecture guidance, and hotspot warnings."
            : "Beginner Mode is off. Toggle it to reveal extra guidance for new contributors."}
        </p>
      </div>
      <Button
        type="button"
        variant={enabled ? "default" : "outline"}
        size="sm"
        className="inline-flex items-center gap-2"
        onClick={onToggle}
        aria-pressed={enabled}
      >
        <span>{enabled ? "🎓 Beginner Mode ON" : "🎓 Beginner Mode OFF"}</span>
      </Button>
    </div>
  );
}
