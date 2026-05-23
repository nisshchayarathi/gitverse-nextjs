import { Sparkles } from "lucide-react";

interface AIEmptyStateProps {
  onGetStarted?: () => void;
  title?: string;
  description?: string;
}

export function AIEmptyState({
  onGetStarted,
  title = "No AI suggestions yet",
  description = "Stage your changes and let AI generate a smart commit message for you.",
}: AIEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-[300px] gap-4 text-center px-6">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-white/10 flex items-center justify-center">
        <Sparkles className="w-6 h-6 text-primary" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
          {description}
        </p>
      </div>
      {onGetStarted && (
        <button
          type="button"
          onClick={onGetStarted}
          className="inline-flex items-center gap-2 mt-2 px-5 py-2 rounded-lg bg-gradient-to-r from-primary to-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Sparkles className="w-4 h-4" />
          Get AI suggestion
        </button>
      )}
    </div>
  );
}
