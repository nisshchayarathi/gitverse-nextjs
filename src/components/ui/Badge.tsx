import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline" | "destructive";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const variantStyles: Record<string, string> = {
    default: "bg-primary/10 text-primary border border-primary/20",
    secondary:
      "bg-secondary text-secondary-foreground border border-secondary/50",
    outline: "bg-transparent text-foreground border border-border",
    destructive:
      "bg-destructive/10 text-destructive border border-destructive/20",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  );
}
