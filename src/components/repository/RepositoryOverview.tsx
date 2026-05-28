"use client";

import React, { useState, useEffect } from "react";
import {
  GitBranch,
  Star,
  GitFork,
  Eye,
  Clock,
  Users,
  Code,
  FileText,
  Activity,
  TrendingUp,
  ExternalLink,
} from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Skeleton,
} from "@/components/ui";

import { FavoriteButton } from "./FavoriteButton";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

interface RepositoryData {
  id: string;
  name: string;
  fullName: string;
  url: string;
  description: string;
  stars: number;
  forks: number;
  watchers: number;
  language: string;
  createdAt: string;
  updatedAt: string;
  size: number;
  defaultBranch: string;
  openIssues: number;
  license?: string;
}

interface RepositoryOverviewProps {
  repositoryData?: any;
}

export const RepositoryOverview = ({
  repositoryData,
}: RepositoryOverviewProps) => {
  const [isFavorited, setIsFavorited] = useState(false);
  const isLoading = true;
  setTimeout(() => {}, 3000);

  interface Props {
    repositoryData?: any;
    isLoading?: boolean;
  }

  const handleToggleFavorite = async (id: string, nextState: boolean) => {
    await new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.7) {
          reject(new Error("Database connection lost. Please try again."));
        } else {
          setIsFavorited(nextState);
          resolve(null);
        }
      }, 1500);
    });
  };

  // Avoid crash when data is missing
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* HEADER SKELETON */}
        <div className="glass rounded-lg p-6 space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-2/3" />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>

        {/* STATS SKELETON */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="glass">
              <CardContent className="pt-6 space-y-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* LOWER SECTION SKELETON */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 glass">
            <CardHeader>
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>

            <CardContent className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </CardHeader>

            <CardContent className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // safe fallback object
  const repository: RepositoryData = {
    id: repositoryData?.id?.toString() || "0",
    name: repositoryData?.name || "Unknown",
    fullName: repositoryData?.fullName || repositoryData?.name || "Unknown",
    url: repositoryData?.url || "#",
    description: repositoryData?.description || "No description available",
    stars: repositoryData?.stars || 0,
    forks: repositoryData?.forks || 0,
    watchers: repositoryData?.watchers || 0,
    language:
      repositoryData?.languages?.[0]?.name ||
      repositoryData?.primaryLanguage ||
      "Unknown",
    createdAt: repositoryData?.createdAt || new Date().toISOString(),
    updatedAt: repositoryData?.analyzedAt
      ? new Date(repositoryData.analyzedAt).toLocaleString()
      : "Unknown",
    size: repositoryData?.size || 0,
    defaultBranch: repositoryData?.defaultBranch || "main",
    openIssues: repositoryData?.openIssues || 0,
    license: repositoryData?.license || undefined,
  };

  return (
    <div className="space-y-6">
      {/* FULL UI */}
      <div className="glass rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <GitBranch className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold truncate">{repository.name}</h1>
            </div>

            <p className="text-sm text-muted-foreground mb-3">
              {repository.description}
            </p>

            <a
              href={repository.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm hover:text-primary"
            >
              <ExternalLink className="h-4 w-4" />
              {repository.fullName}
            </a>
          </div>

          <FavoriteButton
            initialIsFavorited={isFavorited}
            repositoryId={repository.id}
            onToggle={handleToggleFavorite}
          />
        </div>

        {/* QUICK STATS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t">
          <div>
            <Star className="h-4 w-4 text-yellow-500" />
            <div>{repository.stars}</div>
          </div>

          <div>
            <GitFork className="h-4 w-4 text-primary" />
            <div>{repository.forks}</div>
          </div>

          <div>
            <Eye className="h-4 w-4 text-accent" />
            <div>{repository.watchers}</div>
          </div>

          <div>
            <Activity className="h-4 w-4 text-red-500" />
            <div>{repository.openIssues}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
