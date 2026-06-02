import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  suggestions?: string[];
  ariaLabel?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  suggestions,
  ariaLabel,
}: EmptyStateProps) {
  return (
    <section
      role="region"
      aria-label={ariaLabel ?? `${title} empty state`}
      className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-border/50 bg-gradient-to-b from-card/40 to-card/10 shadow-md backdrop-blur-sm w-full min-h-[320px] transition-all duration-300 hover:border-primary/20 hover:shadow-lg"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 ring-8 ring-primary/5 mb-6 text-primary transition-transform duration-300 hover:scale-105">
        <Icon className="h-7 w-7 text-primary" aria-hidden="true" />
      </div>
      <h2 className="text-xl sm:text-2xl font-heading font-bold text-foreground mb-3 tracking-tight">
        {title}
      </h2>
      <p className="text-sm sm:text-base text-muted-foreground max-w-md mb-6 leading-relaxed">
        {description}
      </p>

      {suggestions && suggestions.length > 0 && (
        <div className="w-full max-w-sm rounded-xl bg-background/50 border border-border/40 p-4 mb-6 text-left shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 text-center sm:text-left">
            Suggestions
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {suggestions.map((suggestion, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5 select-none">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {actionLabel && onAction && (
        <Button 
          onClick={onAction} 
          className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 px-6 shadow-md hover:shadow-lg active:scale-95"
        >
          {actionLabel}
        </Button>
      )}
    </section>
  );
}
