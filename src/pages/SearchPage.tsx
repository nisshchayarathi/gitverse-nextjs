"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useDebounce } from "@/src/hooks/useDebounce";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Grid, List, GitBranch, Clock, Activity } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  EmptyState,
} from "@/components/ui";
import { buildApiUrl } from "@/services/apiConfig";
import axios from "axios";

interface Repository {
  id: string;
  name: string;
  url: string;
  description?: string;
  language?: string;
  lastAnalyzed?: string;
  stars?: number;
  commits?: number;
  contributors?: number;
  status?: "completed" | "processing" | "failed";
  createdAt?: string;
  updatedAt?: string;
}

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialUrl = searchParams?.get("repoUrl") || "";

  const [searchQuery, setSearchQuery] = useState(initialUrl);
  const debouncedQuery = useDebounce(searchQuery, 300);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"recent" | "stars" | "name">("recent");
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRepositories();
  }, []);

  const fetchRepositories = async () => {
    try {
      const token = localStorage.getItem("gitverse_token");
      const response = await axios.get(buildApiUrl("/api/repositories"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      // API returns { repositories: [...] }
      const repos = response.data.repositories || [];
      setRepositories(Array.isArray(repos) ? repos : []);
    } catch (error) {
      console.error("Error fetching repositories:", error);
      setRepositories([]);
    } finally {
      setLoading(false);
    }
  };
  function highlightMatch(text: string, query: string) {
  if (!query.trim()) return <span>{text}</span>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-foreground rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

  const filteredRepositories = Array.isArray(repositories)
    ? repositories.filter(
        (repo) =>
          repo.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
          (repo.description || "")
            .toLowerCase()
            .includes(debouncedQuery.toLowerCase())
      )
    : [];

  const sortedRepositories = [...filteredRepositories].sort((a, b) => {
    if (sortBy === "stars") return (b.stars || 0) - (a.stars || 0);
    if (sortBy === "name") return a.name.localeCompare(b.name);
    return 0; // 'recent' is already sorted
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="px-2 sm:px-0">
          <h1 className="text-2xl sm:text-3xl font-heading font-bold mb-2">
            Browse Repositories
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Search and manage your analyzed repositories
          </p>
        </div>

        {/* Search and Filters */}
        <Card className="glass">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search repositories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background/50"
                />
              </div>
              <div className="flex gap-2 flex-row flex-wrap justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setViewMode(viewMode === "grid" ? "list" : "grid")
                  }
                  aria-label="Toggle view mode"
                >
                  {viewMode === "grid" ? (
                    <List className="h-4 w-4" />
                  ) : (
                    <Grid className="h-4 w-4" />
                  )}
                </Button>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 rounded-md border border-input bg-background text-sm min-w-[110px]"
                  aria-label="Sort repositories"
                >
                  <option value="recent">Recent</option>
                  <option value="stars">Most Stars</option>
                  <option value="name">Name</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {sortedRepositories.length}{" "}
            {sortedRepositories.length === 1 ? "repository" : "repositories"}{" "}
            found
          </p>
        </div>

        {/* Repository Grid/List */}
        {loading ? (
         <div
  role="status"
  aria-live="polite"
  className="flex items-center justify-center py-12 text-muted-foreground motion-safe:animate-pulse motion-reduce:animate-none"
>
  <span aria-hidden="true">Loading repositories...</span>
  <span className="sr-only">Loading repositories...</span>
</div>
        ) : sortedRepositories.length === 0 ? (
          searchQuery ? (
            <EmptyState
              icon={Search}
              title="No Results Found"
              description="We couldn't find any repositories matching your search query. Try a different term."
              actionLabel="Clear Search"
              onAction={() => setSearchQuery("")}
            />
          ) : (
            <EmptyState
              icon={GitBranch}
              title="No Repositories Yet"
              description="You haven't analyzed any repositories. Head to the dashboard to get started!"
              actionLabel="Go to Dashboard"
              onAction={() => router.push("/dashboard")}
            />
          )
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {sortedRepositories.map((repo, index) => (
              <Card
                key={repo.id}
                className="glass glass-hover cursor-pointer transition-transform hover:scale-[1.02] focus-within:scale-[1.02]"
                onClick={() => router.push(`/repo/${repo.id}`)}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <GitBranch className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="font-heading text-base sm:text-lg break-all">
                          {highlightMatch(repo.name, debouncedQuery)}
                        </CardTitle>
                        <CardDescription className="text-xs font-mono break-all max-w-[180px] sm:max-w-[240px] md:max-w-[320px] lg:max-w-[400px]">
                          {repo.url}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-4 line-clamp-2 min-h-[32px]">
                    {highlightMatch(repo.description || "No description available", debouncedQuery)}
                  </p>
                  <div className="flex flex-wrap items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Activity className="h-4 w-4" />
                        {(repo as any)._count?.commits || 0}
                      </div>
                      <div className="flex items-center gap-1">
                        <GitBranch className="h-4 w-4" />
                        {(repo as any)._count?.branches || 0}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(
                        (repo as any).lastAnalyzedAt || (repo as any).createdAt
                      ).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/50">
                    {(repo as any).languages?.[0]?.name ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-accent/10 text-accent">
                        {(repo as any).languages[0].name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-muted/50 text-muted-foreground">
                        No language
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedRepositories.map((repo, index) => (
              <Card
                key={repo.id}
                className="glass glass-hover cursor-pointer transition-transform hover:scale-[1.01] focus-within:scale-[1.01]"
                onClick={() => router.push(`/repo/${repo.id}`)}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <CardContent className="pt-4 sm:pt-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                    <div className="p-3 rounded-lg bg-primary/10 self-center">
                      <GitBranch className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-1">
                        <h3 className="font-heading font-semibold text-base sm:text-lg break-all">
                          {highlightMatch(repo.name, debouncedQuery)}
                        </h3>
                        {(repo as any).languages?.[0]?.name && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-accent/10 text-accent">
                            {(repo as any).languages[0].name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-2 line-clamp-2 min-h-[24px]">
                        {highlightMatch(repo.description || "No description available", debouncedQuery)}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Activity className="h-4 w-4" />
                          {(repo as any)._count?.commits || 0} commits
                        </div>
                        <div className="flex items-center gap-1">
                          <GitBranch className="h-4 w-4" />
                          {(repo as any)._count?.branches || 0} branches
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {new Date(
                            (repo as any).lastAnalyzedAt ||
                              (repo as any).createdAt
                          ).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
