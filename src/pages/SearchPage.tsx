"use client";

export const dynamic = "force-dynamic";

import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useRepoBrowsePrefs } from "@/hooks/useRepoBrowsePrefs";
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
  Skeleton,
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
  // Merged: Using useRepoBrowsePrefs from your branch 
  const { viewMode, setViewMode, sortBy, setSortBy } = useRepoBrowsePrefs();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchRepositories();
  }, []);

  const fetchRepositories = async () => {
    setError("");
    try {
      const token = localStorage.getItem("gitverse_token");
      const response = await axios.get(buildApiUrl("/api/repositories"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      // API returns { repositories: [...] }
      const repos = response.data.repositories || [];
      setRepositories(Array.isArray(repos) ? repos : []);
    } catch (error: any) {
      console.error("Error fetching repositories:", error);

      setRepositories([]);

      // Merged: Using the toast error handling from main
      const message =
        error?.response?.data?.message ||
        "Failed to load repositories. Please check your connection and try again.";

      setError(message);

      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredRepositories = Array.isArray(repositories)
    ? repositories.filter(
        (repo) =>
          repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (repo.description || "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
      )
    : [];

  // Merged: Using your fix for explicit date sorting
  const sortedRepositories = [...filteredRepositories].sort((a, b) => {
    if (sortBy === "stars") return (b.stars || 0) - (a.stars || 0);
    if (sortBy === "name") return a.name.localeCompare(b.name);
    
    // Sort by recent explicitly (fallback to 0 if dates are missing)
    const dateA = new Date((a as any).lastAnalyzedAt || a.createdAt || 0).getTime();
    const dateB = new Date((b as any).lastAnalyzedAt || b.createdAt || 0).getTime();
    
    return dateB - dateA; // Descending order (newest first)
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
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    aria-label="Grid view"
                    className={
                      viewMode === "grid"
                        ? "bg-primary/10 text-primary border-primary"
                        : ""
                    }
                  >
                    <Grid className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewMode("list")}
                    aria-label="List view"
                    className={
                      viewMode === "list"
                        ? "bg-primary/10 text-primary border-primary"
                        : ""
                    }
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>

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
          viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="glass">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                    </div>
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex gap-4">
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-4 w-12" />
                      </div>
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="pt-3 border-t border-border/50">
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="glass">
                  <CardContent className="pt-4 sm:pt-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                      <Skeleton className="h-