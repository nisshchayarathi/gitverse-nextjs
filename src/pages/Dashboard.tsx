"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ShortcutHint } from "@/components/ui/ShortcutHint";
import {
  GitBranch,
  TrendingUp,
  Clock,
  Plus,
  Activity,
  Users,
  Code,
  ArrowRight,
} from "lucide-react";
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
import { useAuth } from "@/contexts/AuthContext";
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

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
  fetchRepositories();

  const handleKeyDown = (e: KeyboardEvent) => {
    const active = document.activeElement;

    const isTyping =
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      active instanceof HTMLSelectElement ||
     (active instanceof HTMLElement && active.isContentEditable);

    if (e.key === "/" && !isTyping) {
      e.preventDefault();
      searchRef.current?.focus();
    }

  if (
  e.key === "/" &&
  !e.ctrlKey &&
  !e.metaKey &&
  !e.altKey &&
  !e.shiftKey &&
  !isTyping
) {
    setRepoUrl("");
    searchRef.current?.blur();
    }
  };

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
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

  const totalCommits = Array.isArray(repositories)
    ? repositories.reduce((sum, r: any) => sum + (r._count?.commits || 0), 0)
    : 0;
  const totalContributors = Array.isArray(repositories)
    ? repositories.reduce(
        (sum, r: any) => sum + (r._count?.contributors || 0),
        0
      )
    : 0;
  const totalFiles = Array.isArray(repositories)
    ? repositories.reduce((sum, r: any) => sum + (r._count?.files || 0), 0)
    : 0;

  const stats = [
    {
      label: "Repositories Analyzed",
      value: (Array.isArray(repositories) ? repositories.length : 0).toString(),
      icon: GitBranch,
      change: `${repositories.filter((r: any) => r.status === "completed").length} completed`,
    },
    {
      label: "Total Commits",
      value: totalCommits.toLocaleString(),
      icon: Activity,
      change: `Across ${repositories.length} repos`,
    },
    {
      label: "Contributors",
      value: totalContributors.toLocaleString(),
      icon: Users,
      change: `Active developers`,
    },
    {
      label: "Total Files",
      value: totalFiles.toLocaleString(),
      icon: Code,
      change: `Tracked files`,
    },
  ];

  const recentRepositories = Array.isArray(repositories)
    ? repositories.slice(0, 3)
    : [];

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffInMinutes = Math.floor(
      (now.getTime() - then.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return then.toLocaleDateString();
  };

  const recentActivity = Array.isArray(repositories)
    ? repositories
        .filter((r: any) => r.status === "completed")
        .slice(0, 5)
        .map((repo: any) => ({
          action: "Analyzed",
          repo: repo.name,
          time: formatTimeAgo(repo.lastAnalyzedAt || repo.createdAt),
          status: repo.status,
        }))
    : [];

  const handleAnalyze = async () => {
    if (!repoUrl.trim()) return;

    setAnalyzing(true);
    try {
      const token = localStorage.getItem("gitverse_token");

      // Extract repo name from URL
      const urlParts = repoUrl.trim().split("/");
      const repoName = urlParts[urlParts.length - 1];

      const response = await axios.post(
        buildApiUrl("/api/repositories"),
        {
          name: repoName,
          url: repoUrl.trim(),
          description: `Repository from ${repoUrl}`,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Check if this is an existing repository
      const isExisting = repositories.some(
        (r: any) => r.url === repoUrl.trim()
      );

      // Refresh repositories list
      await fetchRepositories();

      // Navigate to the repository
      router.push(`/repo/${response.data.repository.id}`);

      // Show appropriate message
      if (isExisting) {
        console.log("Navigating to existing repository");
      }

      setRepoUrl("");
    } catch (error: any) {
      console.error("Error creating repository:", error);
      alert(error.response?.data?.error || "Failed to analyze repository");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold mb-2">
            Welcome back, {user?.name}! 👋
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening with your repositories today
          </p>
        </div>

        {/* Quick Analysis Input */}
        <Card className="glass glow-primary">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="url"
                placeholder="https://github.com/username/repository"
                ref={searchRef}
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className="flex-1 bg-background/50"
                onKeyPress={(e) => e.key === "Enter" && handleAnalyze()}
              />
              <Button
                onClick={handleAnalyze}
                disabled={analyzing || !repoUrl.trim()}
                className="bg-gradient-primary hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4 mr-2" />
                {analyzing ? "Analyzing..." : "Analyze Repository"}
              </Button>
            </div>
              <ShortcutHint />
            
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((stat, index) => (
            <Card
              key={stat.label}
              className="glass glass-hover"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardContent className="pt-4 sm:pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1 truncate">
                      {stat.label}
                    </p>
                    <p className="text-2xl sm:text-3xl font-heading font-bold break-words">
                      {stat.value}
                    </p>
                    <p className="text-xs text-accent mt-1 flex items-center gap-1 flex-wrap">
                      <TrendingUp className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{stat.change}</span>
                    </p>
                  </div>
                  <div className="p-2 sm:p-3 rounded-lg bg-primary/10 flex-shrink-0">
                    <stat.icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Recent Repositories */}
          <Card className="lg:col-span-2 glass">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg font-heading">
                    Recent Repositories
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Your recently analyzed projects
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/search")}
                  className="self-start sm:self-auto"
                >
                  View All
                  <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 ml-2" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading repositories...
                </div>
              ) : recentRepositories.length === 0 ? (
                <EmptyState
                  icon={GitBranch}
                  title="No Repositories Yet"
                  description="You haven't analyzed any repositories yet. Enter a GitHub URL above to get started!"
                  actionLabel="Analyze Repository"
                  onAction={() => {
                    const input = document.querySelector('input[type="url"]') as HTMLInputElement;
                    if (input) {
                      input.focus();
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                />
              ) : (
                <div className="space-y-3">
                  {recentRepositories.map((repo) => (
                    <div
                      key={repo.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 rounded-lg border border-border/50 hover:border-primary/50 transition-colors cursor-pointer glass-hover"
                      onClick={() => router.push(`/repo/${repo.id}`)}
                    >
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                          <GitBranch className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium text-sm sm:text-base truncate">
                            {repo.name}
                          </h3>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
                            {repo.url}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span className="hidden sm:inline">
                            {(repo as any)._count?.commits || 0} commits
                          </span>
                          <span className="sm:hidden">
                            {(repo as any)._count?.commits || 0}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                          {(repo as any)._count?.contributors || 0}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                          {formatTimeAgo(
                            (repo as any).lastAnalyzedAt ||
                              (repo as any).createdAt
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg font-heading">
                Recent Activity
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Your latest actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start gap-2 sm:gap-3">
                    <div className="mt-1 p-1.5 rounded-full bg-accent/10 flex-shrink-0">
                      <Activity className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm break-words">
                        <span className="font-medium">{activity.action}</span>{" "}
                        <span className="text-muted-foreground truncate">
                          {activity.repo}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg font-heading">
              Quick Actions
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Get started with these common tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 p-4 sm:p-6 text-xs sm:text-sm"
                onClick={() => router.push("/dashboard")}
              >
                <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="font-medium">Analyze New Repo</span>
                <span className="text-xs text-muted-foreground text-center">
                  Add a new repository
                </span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 p-4 sm:p-6 text-xs sm:text-sm"
                onClick={() => router.push("/search")}
              >
                <GitBranch className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="font-medium">Browse Repos</span>
                <span className="text-xs text-muted-foreground text-center">
                  View all repositories
                </span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 p-4 sm:p-6 text-xs sm:text-sm"
                onClick={() => router.push("/settings")}
              >
                <Users className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="font-medium">Manage Profile</span>
                <span className="text-xs text-muted-foreground text-center">
                  Update settings
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}