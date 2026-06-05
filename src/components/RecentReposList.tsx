import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  GitBranch, 
  Trash2, 
  History, 
  ExternalLink,
  Loader2,
  FolderOpen
} from "lucide-react";
import { useRecentRepos, RecentRepository } from "@/hooks/useRecentRepos";
import { useAuth } from "@/contexts/AuthContext";
import { buildApiUrl } from "@/services/apiConfig";
import axios from "axios";
import { toast } from "@/hooks/use-toast";

export function RecentReposList() {
  const router = useRouter();
  const { repos, clearRepos, isLoaded } = useRecentRepos();
  const { isAuthenticated } = useAuth();
  
  // Track loading state for each card to provide feedback during network lookups
  const [navigatingUrl, setNavigatingUrl] = useState<string | null>(null);

  // Return null if localStorage is not loaded yet or no repos exist
  if (!isLoaded || repos.length === 0) {
    return null;
  }

  // Format time ago
  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const handleCardClick = async (repo: RecentRepository) => {
    if (navigatingUrl) return;
    
    setNavigatingUrl(repo.url);
    
    try {
      // 1. If not authenticated, redirect to login with from param
      if (!isAuthenticated) {
        toast({
          title: "Authentication Required",
          description: "Please log in to view the repository analysis.",
        });
        const target = `/dashboard?analyzeUrl=${encodeURIComponent(repo.url)}`;
        router.push(`/login?from=${encodeURIComponent(target)}`);
        return;
      }

      // 2. If authenticated, fetch user's repositories to see if it already exists
      const token = localStorage.getItem("gitverse_token");
      const response = await axios.get(buildApiUrl("/api/repositories"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      const userRepos = response.data.data?.repositories || [];
      const existingRepo = userRepos.find(
        (r: any) => r.url.toLowerCase().trim() === repo.url.toLowerCase().trim()
      );

      if (existingRepo) {
        // Navigate straight to the visualization page
        router.push(`/repo/${existingRepo.id}`);
      } else {
        // Automatically create and trigger analysis for this repo in the user's account
        toast({
          title: "Importing Repository",
          description: `Adding ${repo.name} to your dashboard...`,
        });

        const createResponse = await axios.post(
          buildApiUrl("/api/repositories"),
          {
            name: repo.name,
            url: repo.url,
            description: `Imported from recently viewed: ${repo.url}`,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const newRepo = createResponse.data.repository;
        router.push(`/repo/${newRepo.id}`);
      }
    } catch (error: any) {
      console.error("Error navigating to recent repository:", error);
      const errMsg = error.response?.data?.error || error.message || "Failed to load repository.";
      toast({
        title: "Navigation Failed",
        description: errMsg,
        variant: "destructive",
      });
      setNavigatingUrl(null);
    }
  };

  return (
    <div 
      className="mt-8 max-w-2xl mx-auto text-left animate-fade-in-up"
      style={{ animationDelay: "0.35s" }}
    >
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          Recently Analyzed
        </h3>
        <button
          onClick={clearRepos}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1 focus:outline-none"
          title="Clear history"
        >
          <Trash2 className="h-3 w-3" />
          Clear
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {repos.map((repo, idx) => {
          const isCurrentLoading = navigatingUrl === repo.url;
          
          return (
            <div
              key={`${repo.url}-${idx}`}
              onClick={() => handleCardClick(repo)}
              className={`group relative p-4 rounded-xl border glass glass-hover cursor-pointer overflow-hidden transition-all duration-300 transform hover:-translate-y-1 ${
                isCurrentLoading ? "opacity-75 ring-1 ring-primary pointer-events-none" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 flex-shrink-0">
                    {isCurrentLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <GitBranch className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 text-left">
                    <h4 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                      {repo.name}
                    </h4>
                    <p className="text-xs text-muted-foreground truncate">
                      {repo.owner}
                    </p>
                  </div>
                </div>

                <div className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="truncate max-w-[140px] font-mono text-muted-foreground/60">
                  github.com/{repo.owner}/{repo.name}
                </span>
                <span className="flex-shrink-0 bg-secondary/50 px-2 py-0.5 rounded-full">
                  {formatTimeAgo(repo.analyzedAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
