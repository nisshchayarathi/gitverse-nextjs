import React from "react";
import { XCircle } from "lucide-react";

export function AnalysisFailureState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 text-center min-h-[50vh]">
      <div className="rounded-full bg-destructive/10 p-4">
        <XCircle className="text-destructive h-12 w-12" />
      </div>
      <h2 className="text-xl font-semibold">Analysis failed</h2>
      <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
    </div>
  );
}
