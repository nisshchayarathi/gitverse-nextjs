import React from 'react';
import Link from 'next/link';
import { FileText, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface DocsEmptyStateProps {
  title?: string;
  description?: string;
  buttonText?: string;
  buttonLink?: string;
  icon?: LucideIcon;
}

export function DocsEmptyState({
  title = "No documentation found",
  description = "Get started by creating your first document or exploring the setup guide.",
  buttonText = "Open Getting Started Guide",
  buttonLink = "/docs",
  icon: Icon = FileText,
}: DocsEmptyStateProps) {
  return (
    <section 
      aria-label="Empty Documentation State"
      className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-border/60 bg-background/40 w-full min-h-[280px] transition-all motion-safe:animate-in motion-safe:fade-in motion-reduce:animate-none"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-5 shadow-sm">
        <Icon className="h-8 w-8 text-primary" aria-hidden="true" />
      </div>
      <h2 className="text-xl sm:text-2xl font-heading font-semibold text-foreground mb-2">
        {title}
      </h2>
      <p className="text-sm sm:text-base leading-relaxed text-muted-foreground max-w-md mb-6">
        {description}
      </p>
      {buttonText && buttonLink && (
        <Button 
          asChild 
          className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 motion-safe:hover:scale-[1.02] motion-reduce:transform-none"
        >
          <Link href={buttonLink} aria-label={buttonText}>
            {buttonText}
          </Link>
        </Button>
      )}
    </section>
  );
}
