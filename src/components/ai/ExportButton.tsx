"use client";

import React, { useState } from "react";
import { Download, Check, AlertCircle } from "lucide-react";
import { downloadMarkdown } from "@/lib/utils/downloadMarkdown";
import { useToast } from "@/hooks/use-toast";

interface ExportButtonProps {
  content: string;
  filename?: string;
  className?: string;
}

export function ExportButton({
  content,
  filename = "gitverse-analysis.md",
  className = "",
}: ExportButtonProps) {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const { toast } = useToast();

  const handleExport = () => {
    if (!content) {
      toast({
        title: "No content",
        description: "There is no content available to export.",
        variant: "destructive",
      });
      return;
    }

    try {
      downloadMarkdown(content, filename);
      setStatus("success");

      toast({
        title: "Export Successful",
        description: "The analysis has been exported to markdown.",
      });

      setTimeout(() => {
        setStatus("idle");
      }, 2000);
    } catch (error) {
      console.error("Failed to export markdown:", error);
      setStatus("error");

      toast({
        title: "Export Failed",
        description: "Browser blocked the download or an error occurred.",
        variant: "destructive",
      });

      setTimeout(() => {
        setStatus("idle");
      }, 2000);
    }
  };

  return (
    <button
      onClick={handleExport}
      className={`glass flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-300 ${
        status === "success"
          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
          : status === "error"
          ? "bg-destructive/10 text-destructive border border-destructive/20"
          : "hover:bg-primary/10 text-muted-foreground hover:text-foreground border border-white/10"
      } ${className}`}
      title="Export to Markdown"
      type="button"
    >
      {status === "success" ? (
        <>
          <Check className="h-3.5 w-3.5 animate-in fade-in zoom-in duration-300" />
          <span>Exported!</span>
        </>
      ) : status === "error" ? (
        <>
          <AlertCircle className="h-3.5 w-3.5 animate-in shake duration-300" />
          <span>Failed</span>
        </>
      ) : (
        <>
          <Download className="h-3.5 w-3.5" />
          <span>Export MD</span>
        </>
      )}
    </button>
  );
}
