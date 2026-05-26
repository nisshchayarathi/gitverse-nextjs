"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import {
  GitBranch,
  TrendingUp,
  Activity,
  Code,
  Users,
  Search,
  Sparkles,
  Award,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Compass,
  CornerDownRight,
  Flame,
  ChevronRight,
} from "lucide-react";
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
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { buildApiUrl } from "@/services/apiConfig";
import { toast } from "@/hooks/use-toast";
import {
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Interfaces
interface GitHubProfile {
  login: string;
  avatar_url: string;
  name: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
}

interface GitHubRepo {
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  created_at: string;
  updated_at: string;
  size: number;
}

interface GitHubEvent {
  type: string;
  created_at: string;
  repo: {
    name: string;
  };
  payload?: any;
}

interface AIInsights {
  techStackOverview: string;
  emergingTrends: string[];
  inactiveSkills: string[];
  consistencyAlerts: string[];
  underutilizedRepos: Array<{ name: string; reason: string }>;
  growthRecommendations: string[];
}

export default function DeveloperGrowth() {
  const [username, setUsername] = useState("");
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Raw GitHub data
  const [profile, setProfile] = useState<GitHubProfile | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [events, setEvents] = useState<GitHubEvent[]>([]);

  // AI insights
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Check connected account username
  const [connectedUsername, setConnectedUsername] = useState<string | null>(null);

  const analysisRequestIdRef = useRef(0);

  // 1. Initial Load: Check if user has connected their GitHub account
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const token = localStorage.getItem("gitverse_token");
        const res = await axios.get(
          buildApiUrl("/api/integrations/github/connected-repos"),
          {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          }
        );
        const accountUser = res.data?.account?.username;
        if (accountUser) {
          setConnectedUsername(accountUser);
          setUsername(accountUser);
          handleAnalyze(accountUser);
        }
      } catch (err) {
        // Suppress errors, let user enter username manually
        console.warn("Connected GitHub check failed:", err);
      }
    };
    checkConnection();
  }, []);

  // 2. Fetch and Analyze Profile
  const handleAnalyze = async (searchUsername: string = username) => {
    const cleanUsername = searchUsername.trim().replace(/^@/, "");
    if (!cleanUsername) return;

    const currentRequestId = ++analysisRequestIdRef.current;

    setLoading(true);
    setError(null);
    setProfile(null);
    setRepos([]);
    setEvents([]);
    setInsights(null);
    setActiveUser(cleanUsername);

    try {
      // Step A: Fetch profile from GitHub public API
      let userRes;
      try {
        userRes = await axios.get(`https://api.github.com/users/${encodeURIComponent(cleanUsername)}`);
      } catch (err: any) {
        if (currentRequestId !== analysisRequestIdRef.current) return;
        if (err.response?.status === 404) {
          throw new Error(`GitHub user "${cleanUsername}" not found. Please double check the spelling.`);
        } else if (err.response?.status === 403) {
          throw new Error("GitHub API rate limit exceeded. Please try again later or configure a GitHub App installation.");
        }
        throw err;
      }

      if (currentRequestId !== analysisRequestIdRef.current) return;
      const profileData: GitHubProfile = userRes.data;
      setProfile(profileData);

      // Step B: Fetch repos (up to 100)
      const reposRes = await axios.get(
        `https://api.github.com/users/${encodeURIComponent(cleanUsername)}/repos?per_page=100&sort=updated`
      );
      if (currentRequestId !== analysisRequestIdRef.current) return;
      const reposList: GitHubRepo[] = Array.isArray(reposRes.data) ? reposRes.data : [];
      setRepos(reposList);

      // Step C: Fetch events (up to 100)
      let eventsList: GitHubEvent[] = [];
      try {
        const eventsRes = await axios.get(
          `https://api.github.com/users/${encodeURIComponent(cleanUsername)}/events?per_page=100`
        );
        if (currentRequestId !== analysisRequestIdRef.current) return;
        eventsList = Array.isArray(eventsRes.data) ? eventsRes.data : [];
      } catch (eventErr) {
        if (currentRequestId !== analysisRequestIdRef.current) return;
        console.warn("Could not load GitHub events:", eventErr);
      }
      if (currentRequestId !== analysisRequestIdRef.current) return;
      setEvents(eventsList);

      // Step D: Calculate metrics and trigger AI generation
      const calcMetrics = calculateMetrics(profileData, reposList, eventsList);
      fetchAIInsights(cleanUsername, calcMetrics, reposList, eventsList, currentRequestId);

      toast({
        title: "Analysis Complete",
        description: `Successfully analyzed GitHub profile for ${cleanUsername}`,
      });
    } catch (err: any) {
      if (currentRequestId !== analysisRequestIdRef.current) return;
      console.error("Analysis error:", err);
      setError(err.message || "Failed to analyze GitHub profile. Please check your internet connection.");
      toast({
        title: "Analysis Failed",
        description: err.message || "An error occurred during analysis.",
        variant: "destructive",
      });
    } finally {
      if (currentRequestId === analysisRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  // 3. Calculation helper: computes scores and metrics for charts
  const calculateMetrics = (
    _prof: GitHubProfile,
    repositories: GitHubRepo[],
    activityEvents: GitHubEvent[]
  ) => {
    // A. Count languages
    const languages: { [key: string]: number } = {};
    repositories.forEach((r) => {
      if (r.language) {
        languages[r.language] = (languages[r.language] || 0) + 1;
      }
    });

    const langArray = Object.entries(languages)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / Math.max(1, repositories.length)) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    // B. Count events by type
    const eventsCount: { [key: string]: number } = {};
    activityEvents.forEach((e) => {
      eventsCount[e.type] = (eventsCount[e.type] || 0) + 1;
    });

    // C. Developer Momentum Score calculations
    const pushCount = eventsCount["PushEvent"] || 0;
    const prCount = eventsCount["PullRequestEvent"] || 0;
    const issuesCount =
      (eventsCount["IssuesEvent"] || 0) + (eventsCount["IssueCommentEvent"] || 0);
    const forkCount = eventsCount["ForkEvent"] || 0;
    const totalStars = repositories.reduce((sum, r) => sum + r.stargazers_count, 0);
    const totalForks = repositories.reduce((sum, r) => sum + r.forks_count, 0);

    const commitsScore = Math.min(300, pushCount * 15);
    const collaborationScore = Math.min(300, prCount * 50 + issuesCount * 25 + forkCount * 30);
    const qualityScore = Math.min(300, repositories.length * 10 + totalStars * 15 + totalForks * 20);
    const diversityScore = Math.min(100, langArray.length * 20);

    const momentumScore = commitsScore + collaborationScore + qualityScore + diversityScore;

    // D. Streak Calculation
    let currentStreak = 0;
    const pushDates = activityEvents
      .filter((e) => e.type === "PushEvent")
      .map((e) => e.created_at.split("T")[0]);
    
    const uniquePushDates = Array.from(new Set(pushDates)).sort().reverse();
    if (uniquePushDates.length > 0) {
      const todayStr = new Date().toISOString().split("T")[0];
      const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0];

      if (uniquePushDates[0] === todayStr || uniquePushDates[0] === yesterdayStr) {
        currentStreak = 1;
        let checkDate = new Date(uniquePushDates[0]);
        for (let i = 1; i < uniquePushDates.length; i++) {
          checkDate.setDate(checkDate.getDate() - 1);
          const expectedStr = checkDate.toISOString().split("T")[0];
          if (uniquePushDates[i] === expectedStr) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
    }

    return {
      languages: langArray,
      eventsBreakdown: eventsCount,
      momentumScore,
      streak: currentStreak,
      pushCount,
      prCount,
      issuesCount,
      forkCount,
      totalStars,
      totalForks,
    };
  };

  // Memoized metrics computation
  const metrics = useMemo(() => {
    if (!profile) return null;
    return calculateMetrics(profile, repos, events);
  }, [profile, repos, events]);

  // 4. AI growth insights fetcher
  const fetchAIInsights = async (
    targetUser: string,
    computedMetrics: any,
    repositories: GitHubRepo[],
    activityEvents: GitHubEvent[],
    requestId?: number
  ) => {
    setLoadingInsights(true);
    try {
      const token = localStorage.getItem("gitverse_token");
      const res = await axios.post(
        buildApiUrl("/api/developer-growth/insights"),
        {
          username: targetUser,
          metrics: {
            languages: computedMetrics.languages,
            eventsBreakdown: computedMetrics.eventsBreakdown,
            momentumScore: computedMetrics.momentumScore,
          },
          repos: repositories.map((r) => ({
            name: r.name,
            description: r.description,
            language: r.language,
            stars: r.stargazers_count,
            forks: r.forks_count,
            updatedAt: r.updated_at,
          })),
          events: activityEvents.map((e) => ({
            type: e.type,
            date: e.created_at,
            repo: e.repo.name,
          })),
        },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );
      if (requestId && requestId !== analysisRequestIdRef.current) return;
      setInsights(res.data?.insights || null);
    } catch (err) {
      if (requestId && requestId !== analysisRequestIdRef.current) return;
      console.error("Failed to load AI insights:", err);
      toast({
        title: "AI Analysis Warning",
        description: "Could not retrieve customized AI recommendations. Displaying metrics engine analytics instead.",
      });
    } finally {
      if (requestId && requestId !== analysisRequestIdRef.current) return;
      setLoadingInsights(false);
    }
  };

  // 5. Skill Evolution Timeline Chart Dataset formatting
  const evolutionData = useMemo(() => {
    if (repos.length === 0) return [];

    // Group repos by creation date (Year-Month)
    const grouped: { [key: string]: { [key: string]: number } } = {};
    const languagesSet = new Set<string>();

    repos.forEach((r) => {
      if (!r.created_at || !r.language) return;
      const date = new Date(r.created_at);
      const label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM format
      languagesSet.add(r.language);

      if (!grouped[label]) {
        grouped[label] = {};
      }
      grouped[label][r.language] = (grouped[label][r.language] || 0) + 1;
    });

    // Sort the month keys chronologically
    const sortedMonths = Object.keys(grouped).sort();
    
    // Accumulate repository language counts chronologically
    const accumulated: { [key: string]: number } = {};
    languagesSet.forEach((lang) => {
      accumulated[lang] = 0;
    });

    const dataset = sortedMonths.map((month) => {
      // Parse YYYY-MM to Readable Date format (e.g. 'Jan 24')
      const [year, monthNum] = month.split("-");
      const dateObj = new Date(Number(year), Number(monthNum) - 1);
      const dateLabel = dateObj.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });

      languagesSet.forEach((lang) => {
        const countThisMonth = grouped[month][lang] || 0;
        accumulated[lang] += countThisMonth;
      });

      return {
        date: dateLabel,
        ...accumulated,
      };
    });

    return dataset;
  }, [repos]);

  // 6. Productivity Radar Chart Dataset formatting
  const productivityData = useMemo(() => {
    if (!metrics) return [];

    const totalEvents = events.length || 1;
    const codingRate = Math.round(((metrics.pushCount) / totalEvents) * 100);
    const collaborationRate = Math.round(((metrics.prCount) / totalEvents) * 100);
    const communityRate = Math.round(((metrics.issuesCount) / totalEvents) * 100);
    const starRate = Math.round(((events.filter((e) => e.type === "WatchEvent").length) / totalEvents) * 100);
    const adminRate = Math.round(
      ((events.filter((e) => ["CreateEvent", "DeleteEvent", "ForkEvent"].includes(e.type)).length) /
        totalEvents) *
        100
    );

    return [
      { subject: "Coding", A: codingRate, fullMark: 100 },
      { subject: "Collaboration", A: collaborationRate, fullMark: 100 },
      { subject: "Community", A: communityRate, fullMark: 100 },
      { subject: "Stars/Watches", A: starRate, fullMark: 100 },
      { subject: "Setup & Admin", A: adminRate, fullMark: 100 },
    ];
  }, [metrics, events]);

  // 7. Activity Heatmap rendering data (Grid of last 90 days)
  const heatmapCells = useMemo(() => {
    const cells = [];
    const today = new Date();

    // Map events to date string
    const eventDatesMap: { [key: string]: number } = {};
    events.forEach((e) => {
      const dateStr = e.created_at.split("T")[0];
      eventDatesMap[dateStr] = (eventDatesMap[dateStr] || 0) + 1;
    });

    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateKey = d.toISOString().split("T")[0];
      const count = eventDatesMap[dateKey] || 0;

      cells.push({
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        dateKey,
        count,
      });
    }
    return cells;
  }, [events]);

  // 8. Milestones determination
  const milestonesList = useMemo(() => {
    if (!metrics) return [];

    const list = [
      {
        id: "polyglot",
        title: "Polyglot Master",
        desc: "Build repositories in 3+ languages",
        unlocked: metrics.languages.length >= 3,
        progress: `${metrics.languages.length}/3`,
      },
      {
        id: "collaborator",
        title: "Collaboration Star",
        desc: "Contribute via Pull Requests or Issues",
        unlocked: metrics.prCount > 0 || metrics.issuesCount > 0,
        progress: `${metrics.prCount + metrics.issuesCount} events`,
      },
      {
        id: "starmagnet",
        title: "Star Magnet",
        desc: "Acquire stargazers on your repositories",
        unlocked: metrics.totalStars >= 5,
        progress: `${metrics.totalStars}/5 stars`,
      },
      {
        id: "builder",
        title: "Consistent Builder",
        desc: "Log 30+ activity events in recent weeks",
        unlocked: events.length >= 30,
        progress: `${events.length}/30 events`,
      },
      {
        id: "fork",
        title: "Open Source Explorer",
        desc: "Fork public repositories to collaborate",
        unlocked: metrics.forkCount >= 1,
        progress: `${metrics.forkCount}/1 forks`,
      },
      {
        id: "community",
        title: "Community Connector",
        desc: "Participate in issue conversations",
        unlocked: metrics.issuesCount >= 3,
        progress: `${metrics.issuesCount}/3 comments`,
      },
    ];

    return list;
  }, [metrics, events]);

  // Archetype & badge details
  const archetypeInfo = useMemo(() => {
    if (!metrics) return { title: "Inactive User", color: "text-muted-foreground", bg: "bg-muted/10", border: "border-muted/20" };
    const score = metrics.momentumScore;
    if (score >= 800) {
      return {
        title: "Elite Polyglot Master 👑",
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
        desc: "Excellent coding diversity, high productivity, and frequent repository engagement.",
      };
    } else if (score >= 500) {
      return {
        title: "Consistent Contributor ⚡",
        color: "text-primary",
        bg: "bg-primary/10",
        border: "border-primary/20",
        desc: "High commit consistency and code updates. Keep building collaborations!",
      };
    } else if (score >= 200) {
      return {
        title: "Active Explorer 🚀",
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
        desc: "Good project volume and coding activity. Focus on consistent streaks.",
      };
    }
    return {
      title: "Beginner Builder 🛠️",
      color: "text-muted-foreground",
      bg: "bg-muted/10",
      border: "border-muted/20",
      desc: "Setting foundations. Commit code regularly to raise your momentum rating.",
    };
  }, [metrics]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Banner Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold mb-2 flex items-center gap-2">
              <TrendingUp className="text-primary h-8 w-8" />
              Developer Growth Intelligence
            </h1>
            <p className="text-muted-foreground text-sm max-w-2xl">
              Visualize your coding consistency, track language evolution, earn custom milestone badges, and retrieve AI-powered progression insights.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="GitHub Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-9 bg-background/50 h-10 w-full"
                onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              />
            </div>
            <Button
              onClick={() => handleAnalyze()}
              disabled={loading || !username.trim()}
              className="bg-gradient-primary hover:opacity-90 transition-opacity h-10 flex-shrink-0"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Analyze
            </Button>
          </div>
        </div>

        {/* Info card for unconnected accounts */}
        {!connectedUsername && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-warning/20 bg-warning/5 text-warning">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div className="text-sm">
              You haven&apos;t connected your GitHub profile in GitVerse yet.
              <span className="font-semibold ml-1">
                Go to the &quot;Contribute&quot; tab
              </span>{" "}
              to connect, or analyze any public profile by entering their username above.
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="col-span-1 glass">
              <CardContent className="pt-6 space-y-4">
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-40 w-full rounded-full" />
                <Skeleton className="h-4 w-1/2 mx-auto" />
              </CardContent>
            </Card>
            <Card className="col-span-2 glass">
              <CardContent className="pt-6 space-y-4">
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          </div>
        ) : error ? (
          <Card className="glass border-destructive/30 bg-destructive/5 text-center p-8">
            <CardContent className="space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-lg font-semibold text-foreground">Analysis Failed</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">{error}</p>
              <Button variant="outline" onClick={() => handleAnalyze()}>
                <RefreshCw className="h-4 w-4 mr-2" /> Retry Analysis
              </Button>
            </CardContent>
          </Card>
        ) : !profile ? (
          <EmptyState
            icon={GitBranch}
            title="Enter a GitHub Profile"
            description="Enter any GitHub username in the top right to generate analytics, score charts, streaks, and custom AI insights."
            actionLabel="Connect GitHub Account"
            onAction={() => (window.location.href = "/contribute")}
          />
        ) : (
          <div className="space-y-6">
            {/* Top overview metrics & momentum score */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Profile Card & Momentum Ring */}
              <Card className="glass glow-primary flex flex-col justify-between">
                <CardHeader className="pb-3 border-b border-border/50">
                  <div className="flex items-center gap-4">
                    <img
                      src={profile.avatar_url}
                      alt={profile.login}
                      className="w-14 h-14 rounded-full border-2 border-primary/50 shadow-md"
                    />
                    <div className="min-w-0">
                      <CardTitle className="truncate text-lg">
                        {profile.name || profile.login}
                      </CardTitle>
                      <CardDescription className="truncate text-xs">
                        @{profile.login}
                      </CardDescription>
                    </div>
                  </div>
                  {profile.bio && (
                    <p className="text-xs text-muted-foreground mt-3 italic">
                      &quot;{profile.bio}&quot;
                    </p>
                  )}
                </CardHeader>
                <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center flex-1">
                  {/* Circular Progress Gauge */}
                  <div className="relative w-40 h-40 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      {/* Grey Track */}
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="hsl(var(--muted))"
                        strokeWidth="10"
                        fill="transparent"
                        className="opacity-20"
                      />
                      {/* Gradient Fill Circle */}
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="url(#momentumGradient)"
                        strokeWidth="10"
                        fill="transparent"
                        strokeDasharray={440}
                        strokeDashoffset={440 - (440 * (metrics?.momentumScore || 0)) / 1000}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                      {/* Gradient Definition */}
                      <defs>
                        <linearGradient id="momentumGradient" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" />
                          <stop offset="100%" stopColor="hsl(var(--accent))" />
                        </linearGradient>
                      </defs>
                    </svg>

                    {/* Content inside ring */}
                    <div className="absolute text-center">
                      <span className="text-3xl font-heading font-extrabold text-foreground">
                        {metrics?.momentumScore}
                      </span>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                        Momentum
                      </p>
                    </div>
                  </div>

                  <div className={`mt-6 text-center px-4 py-2 rounded-xl border ${archetypeInfo.bg} ${archetypeInfo.border}`}>
                    <span className={`text-sm font-heading font-bold ${archetypeInfo.color}`}>
                      {archetypeInfo.title}
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                      {archetypeInfo.desc}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Grid of Key stats */}
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="glass">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <Flame className="h-4 w-4 text-orange-500 fill-orange-500 animate-pulse" />
                      Active Streak
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-heading font-bold text-foreground">
                      {metrics?.streak} Days
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Consecutive active coding days based on PushEvents
                    </p>
                  </CardContent>
                </Card>

                <Card className="glass">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <Code className="h-4 w-4 text-primary" />
                      Total Repositories
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-heading font-bold text-foreground">
                      {profile.public_repos} Repos
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Public projects hosted on GitHub
                    </p>
                  </CardContent>
                </Card>

                <Card className="glass">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <Activity className="h-4 w-4 text-emerald-400" />
                      Weekly Collaboration Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-heading font-bold text-foreground">
                      {metrics && events.length > 0
                        ? Math.round(
                            ((metrics.prCount + metrics.issuesCount) / events.length) * 100
                          )
                        : 0}
                      %
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ratio of PR & Issue events to total actions
                    </p>
                  </CardContent>
                </Card>

                <Card className="glass">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-cyan-400" />
                      Social Impact
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-heading font-bold text-foreground">
                      {metrics?.totalStars} Stars
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Across all public repositories ({metrics?.totalForks} forks)
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Timeline Skill Evolution */}
              <Card className="lg:col-span-2 glass">
                <CardHeader>
                  <CardTitle className="text-base font-heading flex items-center gap-2">
                    <Cpu className="text-primary h-5 w-5" />
                    Skill Evolution Timeline
                  </CardTitle>
                  <CardDescription>
                    Cumulative language adoption tracking across repositories
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  {evolutionData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                      No language evolution timeline data available.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={evolutionData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorLang1" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorLang2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted)/0.1)" />
                        <XAxis
                          dataKey="date"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--background))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "8px",
                            color: "hsl(var(--foreground))",
                          }}
                        />
                        {metrics?.languages.slice(0, 3).map((lang, idx) => (
                          <Area
                            key={lang.name}
                            type="monotone"
                            dataKey={lang.name}
                            stroke={idx === 0 ? "hsl(var(--primary))" : "hsl(var(--accent))"}
                            fillOpacity={1}
                            fill={idx === 0 ? "url(#colorLang1)" : "url(#colorLang2)"}
                            name={lang.name}
                            strokeWidth={2}
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Productivity Radar Chart */}
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-base font-heading flex items-center gap-2">
                    <Activity className="text-emerald-400 h-5 w-5" />
                    Productivity Profile
                  </CardTitle>
                  <CardDescription>
                    Event-type percentage breakdown of recent activity
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center">
                  {productivityData.length === 0 ? (
                    <div className="text-muted-foreground text-sm text-center">
                      No event log history found. Make commits, forks, or issues on GitHub.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={productivityData}>
                        <PolarGrid stroke="hsl(var(--muted)/0.15)" />
                        <PolarAngleAxis
                          dataKey="subject"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                        />
                        <PolarRadiusAxis
                          angle={30}
                          domain={[0, 100]}
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={9}
                        />
                        <Radar
                          name="Rate %"
                          dataKey="A"
                          stroke="hsl(var(--primary))"
                          fill="hsl(var(--primary))"
                          fillOpacity={0.25}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--background))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "8px",
                            color: "hsl(var(--foreground))",
                          }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Heatmap & Milestones Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 90-Day Contribution Map */}
              <Card className="lg:col-span-1 glass flex flex-col justify-between">
                <CardHeader>
                  <CardTitle className="text-base font-heading flex items-center gap-2">
                    <Flame className="text-orange-500 h-5 w-5" />
                    Recent Activity Heatmap
                  </CardTitle>
                  <CardDescription>
                    Visual events map over the last 90 days
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between">
                  <div className="grid grid-cols-10 gap-1.5 p-2 bg-background/30 rounded-xl border border-border/50 max-w-sm mx-auto">
                    {heatmapCells.map((cell, idx) => {
                      let color = "bg-muted/10 border-muted/20";
                      if (cell.count > 0) {
                        if (cell.count < 3) color = "bg-emerald-500/20 border-emerald-500/10 text-emerald-400";
                        else if (cell.count < 8) color = "bg-emerald-500/50 border-emerald-500/20 text-emerald-100";
                        else color = "bg-emerald-500 border-emerald-600 text-white shadow-sm shadow-emerald-500/20";
                      }
                      return (
                        <div
                          key={idx}
                          className={`aspect-square w-full rounded-sm flex items-center justify-center text-[8px] font-medium border ${color} transition-all duration-300 hover:scale-110 cursor-help`}
                          title={`${cell.count} events on ${cell.date}`}
                        >
                          {cell.count > 0 ? cell.count : ""}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-4 px-2">
                    <span>90 Days Ago</span>
                    <div className="flex gap-1 items-center">
                      <span>Less</span>
                      <div className="w-2.5 h-2.5 rounded-sm bg-muted/10 border border-muted/20" />
                      <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/20" />
                      <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/50" />
                      <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                      <span>More</span>
                    </div>
                    <span>Today</span>
                  </div>
                </CardContent>
              </Card>

              {/* Achievements / Milestones */}
              <Card className="lg:col-span-2 glass">
                <CardHeader>
                  <CardTitle className="text-base font-heading flex items-center gap-2">
                    <Award className="text-amber-400 h-5 w-5" />
                    Evolution Milestones
                  </CardTitle>
                  <CardDescription>
                    Unlocked developer achievements from repository history
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {milestonesList.map((m) => (
                      <div
                        key={m.id}
                        className={`flex gap-3 items-center p-3 rounded-xl border transition-all ${
                          m.unlocked
                            ? "bg-primary/5 border-primary/20 shadow-xs"
                            : "bg-background/20 border-border/30 opacity-60"
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            m.unlocked
                              ? "bg-primary/10 text-primary glow-primary"
                              : "bg-muted/10 text-muted-foreground"
                          }`}
                        >
                          <Award className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold flex items-center gap-2">
                            {m.title}
                            {m.unlocked && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">
                                Unlocked
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{m.desc}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Status: <span className="font-semibold">{m.progress}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* AI Powered Smart Growth Insights */}
            <Card className="glass glow-primary overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/50 flex flex-row justify-between items-center gap-4">
                <div>
                  <CardTitle className="text-base font-heading flex items-center gap-2">
                    <Sparkles className="text-primary h-5 w-5 animate-pulse" />
                    AI Growth Intelligence & Insights
                  </CardTitle>
                  <CardDescription>
                    Personalized emerging trends, inactive skills, and development next steps
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    activeUser &&
                    metrics &&
                    fetchAIInsights(activeUser, metrics, repos, events)
                  }
                  disabled={loadingInsights}
                >
                  {loadingInsights ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Regenerate
                </Button>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {loadingInsights ? (
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                ) : !insights ? (
                  <div className="text-center py-6 space-y-4">
                    <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      Insights haven&apos;t generated. Click the button to request AI growth planning.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() =>
                        activeUser &&
                        metrics &&
                        fetchAIInsights(activeUser, metrics, repos, events)
                      }
                    >
                      Generate AI Insights
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Tech Stack Overview */}
                    <div className="p-4 rounded-xl border border-primary/10 bg-primary/5">
                      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                        <Cpu className="h-4 w-4 text-primary" />
                        Tech Stack Overview
                      </h4>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        {insights.techStackOverview}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Emerging Trends & Consistency */}
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                            <TrendingUp className="h-3.5 w-3.5 text-primary" />
                            Emerging Tech Trends
                          </h4>
                          <ul className="space-y-2">
                            {insights.emergingTrends.map((t, idx) => (
                              <li key={idx} className="text-xs flex gap-2 items-start text-muted-foreground leading-relaxed">
                                <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                                <span>{t}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                            <Flame className="h-3.5 w-3.5 text-orange-500" />
                            Consistency & Habits
                          </h4>
                          <ul className="space-y-2">
                            {insights.consistencyAlerts.map((a, idx) => (
                              <li key={idx} className="text-xs flex gap-2 items-start text-muted-foreground leading-relaxed">
                                <ChevronRight className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" />
                                <span>{a}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Inactive Skills & Underutilized Repos */}
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                            Inactive Skills Detected
                          </h4>
                          <ul className="space-y-2">
                            {insights.inactiveSkills.map((s, idx) => (
                              <li key={idx} className="text-xs flex gap-2 items-start text-muted-foreground leading-relaxed">
                                <ChevronRight className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {insights.underutilizedRepos.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                              <GitBranch className="h-3.5 w-3.5 text-cyan-400" />
                              Underutilized Repositories
                            </h4>
                            <ul className="space-y-3">
                              {insights.underutilizedRepos.map((r, idx) => (
                                <li key={idx} className="text-xs space-y-1 bg-background/40 p-2.5 rounded-lg border border-border/30">
                                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                                    <CornerDownRight className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                                    {r.name}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground leading-relaxed pl-5">
                                    {r.reason}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step-by-Step Growth Plan */}
                    <div className="border-t border-border/50 pt-6">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
                        <Compass className="h-3.5 w-3.5 text-primary" />
                        AI Growth recommendations
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {insights.growthRecommendations.map((rec, idx) => (
                          <div key={idx} className="flex gap-3 items-start p-3 bg-background/20 rounded-xl border border-border/30 leading-relaxed text-xs">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-muted-foreground leading-normal">{rec}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
