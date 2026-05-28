import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Settings, Sparkles, X } from "lucide-react";
import { useAISettings } from "@/hooks/useAISettings";
import { ClientAIProvider, AIContext } from "@/lib/ai/clientProvider";

interface Props {
  nodeId: string;
  nodeName: string;
  nodeType: "folder" | "file";
  repositoryFiles: any[]; // The raw file array from the repository
  onClose: () => void;
  onOpenSettings: () => void;
}

export const ModuleSummaryPanel: React.FC<Props> = ({
  nodeId,
  nodeName,
  nodeType,
  repositoryFiles,
  onClose,
  onOpenSettings,
}) => {
  const { settings, isLoaded } = useAISettings();
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!isLoaded) return;
    
    const activeKey = settings.provider === "gemini" ? settings.geminiKey : settings.openaiKey;
    if (!activeKey) {
      setError("Please configure your API key first.");
      onOpenSettings();
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Build context
      let filesToInclude = [];
      if (nodeType === "file") {
        const file = repositoryFiles.find(f => f.path.endsWith(nodeName));
        if (file) filesToInclude.push(file);
      } else {
        // It's a folder, include files inside this folder
        // The nodeId for a folder looks like "folder-src/components"
        const folderPath = nodeId.replace("folder-", "");
        filesToInclude = repositoryFiles.filter(f => f.path.startsWith(folderPath + "/"));
      }

      const context: AIContext = {
        moduleName: nodeName,
        files: filesToInclude.map(f => ({ path: f.path, size: f.size || 0 }))
      };

      const result = await ClientAIProvider.generateModuleSummary(settings.provider, activeKey, context);
      setSummary(result);
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
          <button onClick={onOpenSettings} className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary">
            <Settings size={18} />
          </button>
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
