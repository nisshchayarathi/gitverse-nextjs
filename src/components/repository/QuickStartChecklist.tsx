"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui";
import { ChecklistItem } from "./ChecklistItem";

const STORAGE_KEY = "gitverse-quickstart-checklist";

export type QuickStartChecklistState = {
  readme: boolean;
  components: boolean;
  issues: boolean;
  services: boolean;
  firstPr: boolean;
};

const DEFAULT_CHECKLIST_STATE: QuickStartChecklistState = {
  readme: false,
  components: false,
  issues: false,
  services: false,
  firstPr: false,
};

const CHECKLIST_ITEMS: Array<{
  id: keyof QuickStartChecklistState;
  label: string;
}> = [
  { id: "readme", label: "Read README" },
  { id: "components", label: "Explore Components" },
  { id: "issues", label: "Review Open Issues" },
  { id: "services", label: "Understand Services" },
  { id: "firstPr", label: "Create First PR" },
];

export function QuickStartChecklist() {
  const [checklistState, setChecklistState] = useState<QuickStartChecklistState>(
    DEFAULT_CHECKLIST_STATE,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const savedValue = window.localStorage.getItem(STORAGE_KEY);
      if (savedValue) {
        const parsed = JSON.parse(savedValue) as Partial<QuickStartChecklistState>;
        setChecklistState({ ...DEFAULT_CHECKLIST_STATE, ...parsed });
      }
    } catch {
      setChecklistState(DEFAULT_CHECKLIST_STATE);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checklistState));
  }, [checklistState]);

  const completedCount = Object.values(checklistState).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / CHECKLIST_ITEMS.length) * 100);
  const isComplete = completedCount === CHECKLIST_ITEMS.length;

  const handleToggle = (id: keyof QuickStartChecklistState) => {
    setChecklistState((current) => ({
      ...current,
      [id]: !current[id],
    }));
  };

  return (
    <Card className="glass border border-border/70 transition-all duration-300">
      <CardHeader className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">🚀 Quick Start Checklist</CardTitle>
            <CardDescription>
              Track your progress while learning and contributing to this repository.
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-foreground">
              {completedCount} / {CHECKLIST_ITEMS.length} Completed
            </p>
            <p className="text-xs text-muted-foreground">{progressPercent}%</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 pt-0">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="space-y-2">
          {CHECKLIST_ITEMS.map((item) => (
            <ChecklistItem
              key={item.id}
              id={`quickstart-${item.id}`}
              label={item.label}
              checked={checklistState[item.id]}
              onToggle={() => handleToggle(item.id)}
            />
          ))}
        </div>

        {isComplete && (
          <div className="rounded-2xl border border-emerald-300/60 bg-emerald-500/10 p-4 text-sm text-emerald-700">
            <p className="font-semibold">🎉 Repository onboarding completed!</p>
            <p className="text-muted-foreground">Contributor Ready</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
