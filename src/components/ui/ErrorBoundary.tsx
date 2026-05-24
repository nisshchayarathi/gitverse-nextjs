"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Card, CardContent } from "./Card";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode | ((error: Error, reset: () => void) => React.ReactNode);
  name?: string;
  onReset?: () => void;
  className?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      showDetails: false,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`ErrorBoundary caught an error in [${this.props.name || "Unknown Component"}]:`, error, errorInfo);
  }

  reset = () => {
    this.props.onReset?.();
    this.setState({
      hasError: false,
      error: null,
      showDetails: false,
    });
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const { fallback, name, className } = this.props;

      if (fallback) {
        if (typeof fallback === "function") {
          return fallback(this.state.error, this.reset);
        }
        return fallback;
      }

      const isAISubsection = name?.toLowerCase().includes("ai") || name?.toLowerCase().includes("mentor") || name?.toLowerCase().includes("analysis");

      return (
        <Card className={cn("glass border border-destructive/20 overflow-hidden shadow-xl animate-fade-in-up", className)}>
          <CardContent className="p-6 sm:p-8 flex flex-col items-center text-center space-y-4">
            <div className="p-3 rounded-full bg-destructive/10 text-destructive relative">
              {isAISubsection ? (
                <>
                  <Sparkles className="h-6 w-6 text-primary absolute -top-1 -right-1 animate-pulse" />
                  <AlertTriangle className="h-6 w-6" />
                </>
              ) : (
                <AlertTriangle className="h-6 w-6" />
              )}
            </div>

            <div className="space-y-2 max-w-md">
              <h4 className="text-lg font-semibold tracking-tight">
                {isAISubsection ? "AI Section Unavailable" : "Something went wrong"}
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isAISubsection
                  ? `An error occurred while loading the ${name || "AI Analysis"}. You can try reloading or checking your connection.`
                  : `We encountered an unexpected issue in the ${name || "application section"}.`}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                onClick={this.reset}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 hover:bg-white/10"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Try Again</span>
              </Button>

              <Button
                onClick={this.toggleDetails}
                variant="ghost"
                size="sm"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                {this.state.showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                <span>{this.state.showDetails ? "Hide details" : "Show details"}</span>
              </Button>
            </div>

            {this.state.showDetails && (
              <div className="w-full mt-4 text-left max-h-40 overflow-y-auto rounded-lg bg-black/40 border border-white/10 p-4 font-mono text-xs text-red-400 select-text leading-relaxed">
                <p className="font-semibold text-white mb-1">Error: {this.state.error.message}</p>
                <p className="opacity-75 whitespace-pre-wrap">{this.state.error.stack}</p>
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
