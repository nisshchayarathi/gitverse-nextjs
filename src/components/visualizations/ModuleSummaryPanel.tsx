import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sparkles, X } from "lucide-react";
import type { AIContext } from "@/lib/ai/clientProvider";

interface Props {
  nodeId: string;
  nodeName: string;
  nodeType: "folder" | "file";
  repositoryFiles: any[];
  onClose: () => void;
}

function buildModuleSummaryPrompt(context: AIContext): string {
  const fileList = context.files.slice(0, 50).map((f) => `- ${f.path} (${f.size} bytes)`).join("\n");
  const truncationNotice = context.files.length > 50 ? `\n...and ${context.files.length - 50} more files omitted for brevity.` : "";

  return `Explain the architectural purpose and responsibility of the following module/folder in this repository. 
Module Name: ${context.moduleName}

Contained Files:
${fileList}${truncationNotice}

Provide a concise 2-3 paragraph plain-English summary. Focus on:
1. Architecture overview
2. Module responsibilities
3. Key behaviors based on the file names provided
Be beginner-friendly but technically accurate.`;
}

export const ModuleSummaryPanel: React.FC<Props> = ({
  nodeId,
  nodeName,
  nodeType,
  repositoryFiles,
  onClose,
}) => {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      let filesToInclude = [];
      if (nodeType === "file") {
        const file = repositoryFiles.find(f => f.path.endsWith(nodeName));
        if (file) filesToInclude.push(file);
      } else {
        const folderPath = nodeId.replace("folder-", "");
        filesToInclude = repositoryFiles.filter(f => f.path.startsWith(folderPath + "/"));
      }

      const context: AIContext = {
        moduleName: nodeName,
        files: filesToInclude.map(f => ({ path: f.path, size: f.size || 0 })),
      };

      const prompt = buildModuleSummaryPrompt(context);

      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("gitverse_token")
          : null;

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt,
          messages: [],
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data?.details || "Failed to generate summary");
      }

      setSummary(data.response);
    } catch (err: any) {
      setError(err.message || "Failed to generate summary");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-background/95 backdrop-blur border-l shadow-2xl flex flex-col z-50">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="font-semibold text-lg truncate max-w-[200px]">{nodeName}</h3>
          <p className="text-xs text-muted-foreground capitalize">{nodeType}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {error && (
          <div className="bg-red-500/10 text-red-500 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {!summary && !loading && (
          <div className="flex flex-col items-center justify-center text-center p-6 mt-10 border border-dashed rounded-xl gap-4">
            <Sparkles className="text-purple-500" size={32} />
            <p className="text-sm text-muted-foreground">
              Generate an AI-powered summary of this {nodeType} to understand its architectural purpose.
            </p>
            <Button onClick={handleGenerate} className="w-full mt-2">
              Generate AI Summary
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center p-10 gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            <p className="text-sm text-muted-foreground animate-pulse">Analyzing architecture...</p>
          </div>
        )}

        {summary && !loading && (
          <div className="space-y-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {summary.split("\\n").map((para, i) => (
                <p key={i} className="mb-2 text-sm leading-relaxed whitespace-pre-wrap">{para}</p>
              ))}
            </div>
            <Button variant="outline" onClick={handleGenerate} className="w-full text-xs" size="sm">
              Regenerate Summary
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
