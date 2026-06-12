import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import {
  GitCompare,
  Sparkles,
  Check,
  Loader2,
  Copy,
  RotateCw,
  Users,
  FileCode,
  GitBranch,
  TrendingUp,
  ExternalLink,
  Info,
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
  _count?: {
    commits: number;
    contributors: number;
    files: number;
    branches: number;
  };
  languages: Array<{ name: string; percentage: number }>;
}

interface DetailedRepo extends RepoItem {
  branches: Array<{ name: string; isDefault: boolean }>;
  commits: Array<{ message: string; authorName: string; committedAt: string }>;
  contributors: Array<{ name: string; commits: number }>;
  files: Array<{ path: string; size: number }>;
}

export default function CompareRepositories() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  // Selection state
  const [repoList, setRepoList] = useState<RepoItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isListLoading, setIsListLoading] = useState(true);

  // Comparison result state
  const [detailedRepos, setDetailedRepos] = useState<DetailedRepo[]>([]);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [isComparing, setIsComparing] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [hasCompared, setHasCompared] = useState(false);

  const fetchRepositories = useCallback(async () => {
    try {
      setIsListLoading(true);
      const token = localStorage.getItem("gitverse_token");
      const response = await axios.get(buildApiUrl("/api/repositories?limit=100"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const repos = response.data.data?.repositories || [];
      // Filter only analyzed/complete repositories
      setRepoList(Array.isArray(repos) ? repos : []);
    } catch (error) {
      console.error("Failed to fetch repositories:", error);
    }
  }, []);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    fetchRepositories();
  }, [isAuthLoading, isAuthenticated, router, fetchRepositories]);

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        if (prev.length >= 3) {
          toast({
            title: "Limit Reached",
            description: "You can compare up to 3 repositories side-by-side.",
          });
          return prev;
        }
        return [...prev, id];
      }
    });
  };

  const handleStartCompare = async () => {
    if (selectedIds.length < 2) {
      toast({
        title: "Selection Required",
        description: "Please select at least 2 repositories to compare.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsComparing(true);
      setIsAiLoading(true);
      setHasCompared(true);
      setDetailedRepos([]);
      setAiSummary("");

      const token = localStorage.getItem("gitverse_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // 1. Fetch detailed information for each selected repository
      const detailsPromises = selectedIds.map(async (id) => {
        const response = await axios.get(buildApiUrl(`/api/repositories/${id}`), { headers });
        return response.data;
      });
      const detailedData = await Promise.all(detailsPromises);
      setDetailedRepos(detailedData);

      // 2. Fetch AI comparison analysis
      const aiResponse = await axios.post(
        buildApiUrl("/api/ai/compare"),
        { repositoryIds: selectedIds },
        { headers }
      );
      setAiSummary(aiResponse.data?.comparison || "");
    } catch (error: any) {
      console.error("Failed to compare repositories:", error);
      toast({
        title: "Comparison Error",
        description: error.response?.data?.error || "Failed to compare codebases.",
        variant: "destructive",
      });
    } finally {
      setIsComparing(false);
      setIsAiLoading(false);
    }
  };

  const handleCopySummary = () => {
    if (!aiSummary) return;
    navigator.clipboard.writeText(aiSummary);
    toast({
      title: "Copied!",
      description: "AI Comparison Summary copied to clipboard.",
    });
  };

  const handleReset = () => {
    setDetailedRepos([]);
    setAiSummary("");
    setHasCompared(false);
    setSelectedIds([]);
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
              <GitCompare className="h-8 w-8 text-primary animate-pulse" />
              Compare <span className="text-gradient">Repositories</span>
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Select two or three analyzed codebases to analyze tech stack overlaps, contrast codebase activities, and generate principal architect AI summary comparisons.
            </p>
          </div>
          {hasCompared && (
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-lg bg-white/5 border border-border/50 hover:bg-white/10 text-sm font-medium transition-all"
            >
              Clear Comparison
            </button>
          )}
        </div>

        {/* State 1: Selection Dashboard */}
        {!hasCompared && (
          <div className="space-y-6">
            <div className="glass border border-border/50 rounded-2xl p-6">
              <div className="flex items-center justify-between border-b border-border/50 pb-4 mb-6">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary" />
                    Select Codebases ({selectedIds.length}/3)
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select 2 or 3 repositories to contrast side-by-side.
                  </p>
                </div>
                <button
                  onClick={handleStartCompare}
                  disabled={selectedIds.length < 2 || isListLoading}
                  className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/95 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
                >
                  <Sparkles className="h-4 w-4" />
                  Compare Now
                </button>
              </div>

              {isListLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Loading analyzed codebases...</p>
                </div>
              ) : repoList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center glass rounded-xl border border-dashed border-border/50">
                  <Info className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg text-foreground">No Repositories Available</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    You haven&apos;t added or analyzed any repositories yet. Head to the visualize page to analyze one!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {repoList.map((repo) => {
                    const isSelected = selectedIds.includes(repo.id);
                    return (
                      <div
                        key={repo.id}
                        onClick={() => handleToggleSelect(repo.id)}
                        className={`group cursor-pointer glass border rounded-xl p-5 transition-all duration-300 relative ${
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border/50 hover:border-border hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors line-clamp-1">
                              {repo.name}
                            </h3>
                            <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                              {repo.description || "No description provided."}
                            </p>
                          </div>
                          <div
                            className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                              isSelected
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-border/50 group-hover:border-primary/50"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                        </div>

                        {/* Tech list tag overlay */}
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {repo.languages?.slice(0, 3).map((l) => (
                            <span
                              key={l.name}
                              className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-border/50 text-muted-foreground"
                            >
                              {l.name}
                            </span>
                          ))}
                          {repo.languages?.length > 3 && (
                            <span className="text-[10px] px-2 py-0.5 text-muted-foreground">
                              +{repo.languages.length - 3} more
                            </span>
                          )}
                        </div>

                        {/* Counts grid overlay */}
                        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border/20 text-center">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                              Commits
                            </span>
                            <span className="text-sm font-semibold text-foreground">
                              {repo._count?.commits || 0}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                              Contribs
                            </span>
                            <span className="text-sm font-semibold text-foreground">
                              {repo._count?.contributors || 0}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                              Files
                            </span>
                            <span className="text-sm font-semibold text-foreground">
                              {repo._count?.files || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* State 2: Comparison Result Dashboard */}
        {hasCompared && (
          <div className="space-y-8">
            {/* Top Side-by-Side Metadata Cards */}
            <div className={`grid grid-cols-1 md:grid-cols-${detailedRepos.length || 2} gap-6`}>
              {detailedRepos.length === 0
                ? Array.from({ length: selectedIds.length }).map((_, idx) => (
                    <div key={idx} className="glass border border-border/50 rounded-2xl p-6 h-64 animate-pulse" />
                  ))
                : detailedRepos.map((repo) => (
                    <div
                      key={repo.id}
                      className="glass border border-border/50 rounded-2xl p-6 relative overflow-hidden group hover:border-border hover:shadow-xl transition-all duration-300"
                    >
                      {/* Gradient Backdrop Accent */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full group-hover:bg-primary/10 transition-colors" />

                      <div className="relative">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <h2 className="text-2xl font-bold text-foreground truncate">{repo.name}</h2>
                          <a
                            href={repo.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                            aria-label="View on GitHub"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem] mb-6">
                          {repo.description || "No repository description listed."}
                        </p>

                        {/* Benchmark grid */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="glass border border-border/30 rounded-xl p-4 flex items-center gap-3">
                            <TrendingUp className="h-5 w-5 text-primary shrink-0" />
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                                Commits
                              </span>
                              <span className="text-lg font-bold text-foreground">
                                {repo.commits?.length || repo._count?.commits || 0}
                              </span>
                            </div>
                          </div>

                          <div className="glass border border-border/30 rounded-xl p-4 flex items-center gap-3">
                            <Users className="h-5 w-5 text-accent shrink-0" />
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                                Contributors
                              </span>
                              <span className="text-lg font-bold text-foreground">
                                {repo.contributors?.length || repo._count?.contributors || 0}
                              </span>
                            </div>
                          </div>

                          <div className="glass border border-border/30 rounded-xl p-4 flex items-center gap-3">
                            <FileCode className="h-5 w-5 text-emerald-500 shrink-0" />
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                                Files Count
                              </span>
                              <span className="text-lg font-bold text-foreground">
                                {repo.files?.length || repo._count?.files || 0}
                              </span>
                            </div>
                          </div>

                          <div className="glass border border-border/30 rounded-xl p-4 flex items-center gap-3">
                            <GitBranch className="h-5 w-5 text-blue-500 shrink-0" />
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                                Branches
                              </span>
                              <span className="text-lg font-bold text-foreground">
                                {repo.branches?.length || repo._count?.branches || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
            </div>

            {/* Language & Stack Comparison Overlay */}
            <div className="glass border border-border/50 rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <FileCode className="h-5 w-5 text-primary" />
                Technology Stack Comparison
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {detailedRepos.length === 0
                  ? Array.from({ length: selectedIds.length }).map((_, idx) => (
                      <div key={idx} className="h-32 bg-white/5 animate-pulse rounded-xl" />
                    ))
                  : detailedRepos.map((repo) => (
                      <div key={repo.id} className="space-y-4">
                        <h4 className="font-bold text-sm text-foreground">{repo.name} Languages</h4>
                        <div className="space-y-3">
                          {repo.languages?.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No language stats available.</p>
                          ) : (
                            repo.languages.map((l) => (
                              <div key={l.name} className="space-y-1">
                                <div className="flex justify-between text-xs font-medium">
                                  <span>{l.name}</span>
                                  <span className="text-muted-foreground">{l.percentage.toFixed(1)}%</span>
                                </div>
                                <div className="h-2 w-full bg-white/5 border border-border/20 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-primary rounded-full transition-all duration-500"
                                    style={{ width: `${l.percentage}%` }}
                                  />
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
              </div>
            </div>

            {/* Contributor Activity & Lists */}
            <div className="glass border border-border/50 rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Top Contributor Activity Comparison
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {detailedRepos.length === 0
                  ? Array.from({ length: selectedIds.length }).map((_, idx) => (
                      <div key={idx} className="h-48 bg-white/5 animate-pulse rounded-xl" />
                    ))
                  : detailedRepos.map((repo) => (
                      <div key={repo.id} className="space-y-3">
                        <h4 className="font-bold text-sm text-foreground mb-2">{repo.name} Contributors</h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                          {repo.contributors?.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No contributor details recorded.</p>
                          ) : (
                            repo.contributors.slice(0, 5).map((c, i) => (
                              <div
                                key={c.name}
                                className="flex items-center justify-between glass border border-border/30 rounded-lg p-2.5 text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 font-bold text-primary text-[10px]">
                                    {i + 1}
                                  </div>
                                  <span className="font-medium text-foreground truncate">{c.name}</span>
                                </div>
                                <span className="font-semibold text-muted-foreground shrink-0">
                                  {c.commits} commits
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
              </div>
            </div>

            {/* Principal Architect AI Comparison Section */}
            <div className="glass border border-border/50 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-primary" />

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Principal AI Architecture Comparison</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Gemini&apos;s deep side-by-side codebase architectural summary and integration potential assessments.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopySummary}
                    disabled={!aiSummary || isAiLoading}
                    className="p-2 rounded-lg bg-white/5 border border-border/50 hover:bg-white/10 disabled:opacity-50 text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 text-xs font-semibold"
                    title="Copy AI Summary"
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </button>
                  <button
                    onClick={handleStartCompare}
                    disabled={isAiLoading}
                    className="p-2 rounded-lg bg-white/5 border border-border/50 hover:bg-white/10 disabled:opacity-50 text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 text-xs font-semibold"
                    title="Refresh AI Analysis"
                  >
                    <RotateCw className={`h-4 w-4 ${isAiLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                </div>
              </div>

              {isAiLoading ? (
                <div className="space-y-4 py-8">
                  <div className="flex items-center gap-2.5 text-sm text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Architect AI is synthesizing comparisons and code patterns...</span>
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
                      h1: ({ children }) => (
                        <h1 className="text-2xl font-bold font-heading text-foreground mt-6 mb-4 border-b border-border/50 pb-2 first:mt-0">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-xl font-bold font-heading text-foreground mt-5 mb-3">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-lg font-bold font-heading text-foreground mt-4 mb-2">
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
                    {aiSummary || "No AI architectural summary is generated yet. Please refresh the comparison."}
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
