import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  Code,
  Bug,
  Lightbulb,
  FileText,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type AnalysisType = "explain" | "bugs" | "improve" | "document";

interface AIExplanationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCode: string;
  language: string;
  fileContext?: string;
}

export const AIExplanationPanel: React.FC<AIExplanationPanelProps> = ({
  isOpen,
  onClose,
  selectedCode,
  language,
  fileContext,
}) => {
  const [analysisType, setAnalysisType] = useState<AnalysisType>("explain");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const handleAnalyze = async (type: AnalysisType) => {
    if (!selectedCode.trim()) return;

    if (!isAuthenticated) {
      toast({
        title: "Login required",
        description: "Please log in to use AI features.",
        variant: "destructive",
      });
      return;
    }

    setAnalysisType(type);
    setIsAnalyzing(true);
    setResult(null);

    try {
      // Reusing the existing analyze-code endpoint
      const response = await fetch("/api/ai/analyze-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: selectedCode,
          language: language || "typescript", // fallback
          analysisType: type,
          context: fileContext || "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze code");
      }

      setResult(data.analysis);
    } catch (error: any) {
      console.error("AI Analysis error:", error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze code",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Automatically trigger explanation when panel opens with new code
  useEffect(() => {
    if (isOpen && selectedCode) {
      handleAnalyze("explain");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedCode]);

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  // Simple Markdown formatting function for the result (since full react-markdown isn't imported here, but we can reuse the logic from CodeAnalysisPanel)
  const formatResult = (content: string) => {
    return content.split("\n").map((line, i) => {
      if (line.startsWith("```")) {
        return <div key={i} className="text-xs text-primary my-2">───────</div>;
      }
      if (line.includes("**")) {
        const parts = line.split("**");
        return (
          <p key={i} className="mb-2">
            {parts.map((part, j) =>
              j % 2 === 0 ? part : <strong key={j}>{part}</strong>
            )}
          </p>
        );
      }
      if (/^\d+\./.test(line.trim())) {
        return (
          <li key={i} className="ml-4 mb-1 list-decimal">
            {line.trim().substring(line.indexOf(".") + 1).trim()}
          </li>
        );
      }
      if (line.trim().startsWith("-") || line.trim().startsWith("•")) {
        return (
          <li key={i} className="ml-4 mb-1 list-disc">
            {line.trim().substring(1).trim()}
          </li>
        );
      }
      if (line.includes("`")) {
        const parts = line.split("`");
        return (
          <p key={i} className="mb-2">
            {parts.map((part, j) =>
              j % 2 === 0 ? (
                part
              ) : (
                <code key={j} className="bg-primary/10 px-1 py-0.5 rounded text-sm font-mono">
                  {part}
                </code>
              )
            )}
          </p>
        );
      }
      return line.trim() ? <p key={i} className="mb-2">{line}</p> : <br key={i} />;
    });
  };

  const actionButtons = [
    { type: "explain" as AnalysisType, label: "Explain", icon: Code },
    { type: "bugs" as AnalysisType, label: "Find Bugs", icon: Bug },
    { type: "improve" as AnalysisType, label: "Improve", icon: Lightbulb },
    { type: "document" as AnalysisType, label: "Docs", icon: FileText },
  ];

  return (
    <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[450px] bg-background/95 backdrop-blur-xl border-l border-white/10 z-[60] flex flex-col shadow-2xl animate-fade-in-right">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-primary/5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          <h3 className="font-bold text-lg">AI Code Assistant</h3>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Selected Code Snippet Preview */}
      <div className="p-4 border-b border-white/10 bg-black/20">
        <div className="text-xs text-muted-foreground mb-2 flex justify-between items-center">
          <span>Selected snippet ({language})</span>
          {selectedCode.length > 500 && (
            <span className="text-yellow-500">Truncated for display</span>
          )}
        </div>
        <pre className="text-xs font-mono p-3 bg-black/40 rounded-lg overflow-x-auto max-h-32 overflow-y-auto text-gray-300">
          {selectedCode.length > 500
            ? selectedCode.substring(0, 500) + "\n..."
            : selectedCode}
        </pre>
      </div>

      {/* Action Buttons */}
      <div className="p-4 grid grid-cols-4 gap-2 border-b border-white/10">
        {actionButtons.map((btn) => (
          <button
            key={btn.type}
            onClick={() => handleAnalyze(btn.type)}
            disabled={isAnalyzing}
            className={`flex flex-col items-center justify-center p-2 rounded-lg text-xs transition-colors ${
              analysisType === btn.type && !isAnalyzing
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-white/5 hover:bg-white/10 border border-transparent"
            } disabled:opacity-50`}
          >
            <btn.icon className="h-4 w-4 mb-1" />
            {btn.label}
          </button>
        ))}
      </div>

      {/* Result Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {isAnalyzing ? (
          <div className="h-full flex flex-col items-center justify-center space-y-4 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm animate-pulse">Analyzing code with Gemini...</p>
          </div>
        ) : result ? (
          <div className="space-y-4 animate-fade-in-up">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold text-primary uppercase tracking-wider">
                {actionButtons.find(b => b.type === analysisType)?.label} Result
              </h4>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs px-2 py-1 bg-white/5 hover:bg-white/10 rounded transition-colors text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="text-sm leading-relaxed prose prose-invert max-w-none prose-sm">
              {formatResult(result)}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
