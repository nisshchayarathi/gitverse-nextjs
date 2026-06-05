import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import {
  FileDiff,
  Sparkles,
  Loader2,
  Copy,
  Check,
  RotateCw,
  Upload,
  Info,
  GitPullRequest,
  CheckCircle,
  AlertTriangle,
  Flame,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { buildApiUrl } from "@/services/apiConfig";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface RepoItem {
  id: number;
  name: string;
  url: string;
  description?: string;
}

export default function PRSimulator() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  // Lists & selection state
  const [repoList, setRepoList] = useState<RepoItem[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<number | "">("");
  const [isListLoading, setIsListLoading] = useState(true);

  // Diff inputs
  const [diffInput, setDiffInput] = useState("");
  const [dragActive, setDragActive] = useState(false);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState("");
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [copiedState, setCopiedState] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    fetchRepositories();
  }, [isAuthLoading, isAuthenticated]);

  const fetchRepositories = async () => {
    try {
      setIsListLoading(true);
      const token = localStorage.getItem("gitverse_token");
      const response = await axios.get(buildApiUrl("/api/repositories?limit=100"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const repos = response.data.data?.repositories || [];
      setRepoList(Array.isArray(repos) ? repos : []);
    } catch (error) {
      console.error("Failed to load repositories:", error);
      toast({
        title: "Error",
        description: "Failed to load repositories list",
        variant: "destructive",
      });
    } finally {
      setIsListLoading(false);
    }
  };

  const handleStartReview = async () => {
    if (!diffInput.trim()) {
      toast({
        title: "Diff Required",
        description: "Please paste a valid git diff or upload a patch file.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAnalyzing(true);
      setHasAnalyzed(true);
      setAnalysisResult("");

      const token = localStorage.getItem("gitverse_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await axios.post(
        buildApiUrl("/api/ai/simulate-pr"),
        {
          repositoryId: selectedRepoId ? Number(selectedRepoId) : undefined,
          diff: diffInput,
        },
        { headers }
      );

      setAnalysisResult(response.data?.review || "");
    } catch (error: any) {
      console.error("Failed to simulate pull request:", error);
      toast({
        title: "Simulator Error",
        description: error.response?.data?.error || "Failed to analyze the pull request diff.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopySummary = () => {
    if (!analysisResult) return;
    navigator.clipboard.writeText(analysisResult);
    setCopiedState(true);
    toast({
      title: "Copied!",
      description: "Automated PR simulated review copied to clipboard.",
    });
    setTimeout(() => setCopiedState(false), 2000);
  };

  // Drag and drop events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === "string") {
          setDiffInput(text);
          toast({
            title: "File Loaded",
            description: `Successfully loaded diff from ${file.name}`,
          });
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === "string") {
          setDiffInput(text);
          toast({
            title: "File Uploaded",
            description: `Successfully loaded diff from ${file.name}`,
          });
        }
      };
      reader.readAsText(file);
    }
  };

  const handleReset = () => {
    setDiffInput("");
    setAnalysisResult("");
    setHasAnalyzed(false);
    setSelectedRepoId("");
  };

  const chatMarkdownSchema = {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      code: [...(defaultSchema.attributes?.code || []), "className"],
      span: [...(defaultSchema.attributes?.span || []), "className"],
    },
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold flex items-center gap-3">
              <FileDiff className="h-8 w-8 text-primary animate-pulse" />
              AI Pull Request <span className="text-gradient">Simulator</span>
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Paste your local git diff output or upload a patch file to run a simulated code review before pushing or creating a pull request.
            </p>
          </div>
          {hasAnalyzed && (
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-lg bg-white/5 border border-border/50 hover:bg-white/10 text-sm font-medium transition-all"
            >
              Reset Simulator
            </button>
          )}
        </div>

        {/* State 1: Input Diff Dashboard */}
        {!hasAnalyzed && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Control Panel */}
            <div className="space-y-6 lg:col-span-1">
              <div className="glass border border-border/50 rounded-2xl p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Info className="h-5 w-5 text-primary" />
                    Review Settings
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Configure repository context and input parameters.
                  </p>
                </div>

                {/* Optional Repository Context */}
                <div className="space-y-2">
                  <label htmlFor="repoSelect" className="text-sm font-medium text-foreground block">
                    Repository Context (Optional)
                  </label>
                  <select
                    id="repoSelect"
                    value={selectedRepoId}
                    onChange={(e) => setSelectedRepoId(e.target.value === "" ? "" : Number(e.target.value))}
                    disabled={isListLoading}
                    className="w-full bg-background border border-border/50 rounded-lg p-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all"
                  >
                    <option value="">No repository context</option>
                    {repoList.map((repo) => (
                      <option key={repo.id} value={repo.id}>
                        {repo.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-muted-foreground leading-normal block">
                    Providing a repository context helps Gemini cross-reference changes with codebase technology configurations.
                  </span>
                </div>

                {/* Simulated Review Actions */}
                <div className="pt-4 border-t border-border/20">
                  <button
                    onClick={handleStartReview}
                    disabled={!diffInput.trim() || isAnalyzing}
                    className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/95 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing Diff...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Analyze & Simulate PR
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Instructions Panel */}
              <div className="glass border border-border/50 rounded-2xl p-6 space-y-4">
                <h4 className="font-bold text-sm text-foreground">How to generate a git diff:</h4>
                <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">Uncommitted changes in local directory:</p>
                    <code className="block bg-white/5 p-2 rounded font-mono text-[11px] text-primary">
                      git diff
                    </code>
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">Staged changes:</p>
                    <code className="block bg-white/5 p-2 rounded font-mono text-[11px] text-primary">
                      git diff --cached
                    </code>
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">Compare branch with main branch:</p>
                    <code className="block bg-white/5 p-2 rounded font-mono text-[11px] text-primary">
                      git diff main...my-feature-branch
                    </code>
                  </div>
                </div>
              </div>
            </div>

            {/* Diff Entry Panel */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Enter Git Diff / Patch Content</span>
                <span className="text-xs text-muted-foreground">Supports pasting or drag & drop</span>
              </div>

              {/* Drag and Drop Area */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`glass border rounded-2xl overflow-hidden transition-all duration-300 ${
                  dragActive ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border/50"
                }`}
              >
                {/* File Uploader and Text input area */}
                <div className="flex flex-col h-[500px]">
                  {/* File Upload Zone */}
                  {diffInput.trim() === "" && (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 border-b border-border/20 text-center relative">
                      <input
                        type="file"
                        accept=".diff,.patch,.txt"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Upload className="h-6 w-6 text-primary" />
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        Drag and drop your diff/patch file here, or click to upload
                      </p>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Accepts .diff, .patch, or .txt files (max 2MB)
                      </p>
                    </div>
                  )}

                  {/* Monospace Text Area */}
                  <textarea
                    value={diffInput}
                    onChange={(e) => setDiffInput(e.target.value)}
                    placeholder="--- a/src/auth.ts&#10;+++ b/src/auth.ts&#10;@@ -12,4 +12,6 @@&#10;+ export function validateToken(token: string) {&#10;+   return token.length > 10;&#10;+ }"
                    className="flex-1 p-5 bg-black/30 text-xs font-mono text-emerald-400 focus:outline-none resize-none leading-relaxed custom-scrollbar"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* State 2: Simulated Review Results */}
        {hasAnalyzed && (
          <div className="space-y-6">
            <div className="glass border border-border/50 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-primary" />

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/50 pb-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <GitPullRequest className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Simulated AI Pull Request Review</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Principal architect quality feedback, bug detections, and automated PR descriptions.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopySummary}
                    disabled={!analysisResult || isAnalyzing}
                    className="p-2.5 rounded-lg bg-white/5 border border-border/50 hover:bg-white/10 disabled:opacity-50 text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 text-xs font-semibold"
                    title="Copy Full AI Review"
                  >
                    {copiedState ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    {copiedState ? "Copied!" : "Copy Review"}
                  </button>
                  <button
                    onClick={handleStartReview}
                    disabled={isAnalyzing}
                    className="p-2.5 rounded-lg bg-white/5 border border-border/50 hover:bg-white/10 disabled:opacity-50 text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 text-xs font-semibold"
                    title="Re-run Simulation"
                  >
                    <RotateCw className={`h-4 w-4 ${isAnalyzing ? "animate-spin" : ""}`} />
                    Re-run
                  </button>
                </div>
              </div>

              {isAnalyzing ? (
                <div className="space-y-4 py-8">
                  <div className="flex items-center gap-2.5 text-sm text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Gemini is scanning code diffs, tracking regressions, and building summaries...</span>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-white/5 animate-pulse rounded-lg w-full" />
                    <div className="h-4 bg-white/5 animate-pulse rounded-lg w-11/12" />
                    <div className="h-4 bg-white/5 animate-pulse rounded-lg w-10/12" />
                    <div className="h-4 bg-white/5 animate-pulse rounded-lg w-full" />
                    <div className="h-4 bg-white/5 animate-pulse rounded-lg w-9/12" />
                  </div>
                </div>
              ) : (
                <div className="prose prose-invert max-w-none text-sm text-muted-foreground leading-relaxed pt-2">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[[rehypeSanitize, chatMarkdownSchema]]}
                    components={{
                      h1: ({ children }) => {
                        // Dynamically add icons or styles based on heading name
                        const text = String(children);
                        let icon = <CheckCircle className="h-5 w-5 text-primary shrink-0" />;
                        if (text.toLowerCase().includes("bug")) {
                          icon = <AlertTriangle className="h-5 w-5 text-accent shrink-0" />;
                        } else if (text.toLowerCase().includes("security")) {
                          icon = <Flame className="h-5 w-5 text-red-500 shrink-0" />;
                        } else if (text.toLowerCase().includes("github pr") || text.toLowerCase().includes("automated")) {
                          icon = <GitPullRequest className="h-5 w-5 text-emerald-500 shrink-0" />;
                        }
                        return (
                          <h1 className="text-xl font-bold font-heading text-foreground mt-8 mb-4 border-b border-border/50 pb-2 first:mt-0 flex items-center gap-2.5">
                            {icon}
                            {children}
                          </h1>
                        );
                      },
                      h2: ({ children }) => (
                        <h2 className="text-lg font-bold font-heading text-foreground mt-6 mb-3">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-base font-bold font-heading text-foreground mt-4 mb-2">
                          {children}
                        </h3>
                      ),
                      p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
                      a: ({ href, children, ...props }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent underline underline-offset-4"
                          {...props}
                        >
                          {children}
                        </a>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc pl-5 space-y-2 my-4">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal pl-5 space-y-2 my-4">{children}</ol>
                      ),
                      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                      code: ({ className, children, ...props }) => {
                        const isBlock = String(children).includes("\n");
                        if (isBlock) {
                          return (
                            <pre className="bg-black/40 border border-border/30 rounded-lg p-4 overflow-x-auto my-3 text-xs font-mono text-primary leading-relaxed">
                              <code {...props}>{children}</code>
                            </pre>
                          );
                        }
                        return (
                          <code
                            className="bg-white/5 px-1.5 py-0.5 rounded text-sm font-mono text-primary font-medium"
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {analysisResult || "No review results were generated. Please re-run the simulator."}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
