import { LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <section className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-dashed border-border/60 bg-background/30 w-full min-h-[250px]">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
        <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
      </div>
      <h2 className="text-lg sm:text-xl font-heading font-semibold text-foreground mb-2">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          {actionLabel}
        </Button>
      )}
    </section>
  );
}
