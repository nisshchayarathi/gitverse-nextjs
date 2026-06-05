"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { ArrowLeft, MessageSquare } from "lucide-react";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AIChatInterface } from "@/components/ai/AIChatInterface";
import { buildApiUrl } from "@/services/apiConfig";

export default function RepoChatPage() {
  const params = useParams();
  const id = params?.id as string;
  const [repository, setRepository] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRepository = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("gitverse_token");
      const response = await axios.get(
        buildApiUrl(`/api/repositories/${id}`),
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const repo = response.data.repository || response.data;
      setRepository(repo);
    } catch (err: any) {
      console.error("Error fetching repository:", err);
      setError(err.response?.data?.error || "Failed to load repository details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRepository();
  }, [fetchRepository]);

  const repositoryContext = repository
    ? {
        name: repository.name,
        description: repository.description,
        languages: (repository.languages || []).map((l: any) => l.name),
        stats: {
          commits: repository.commits?.length || 0,
          contributors: repository.contributors?.length || 0,
          files: repository.files?.length || 0,
        },
      }
    : undefined;

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="flex flex-col h-[calc(100vh-6rem)] space-y-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/repo/${id}`}
              className="glass p-2 rounded-lg hover:bg-white/10 transition-all duration-300"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate flex items-center gap-2">
                <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                {loading ? "Loading..." : `${repository?.name || "Repository"} Chat`}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                Ask questions about your repository — AI-powered with RAG context
              </p>
            </div>
          </div>

          <div className="flex-1 glass rounded-lg overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="text-sm text-muted-foreground">Loading repository...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-4 max-w-md text-center p-6 glass rounded-xl border border-red-500/20">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                    <MessageSquare className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-semibold">Failed to load repository</h3>
                  <p className="text-sm text-muted-foreground">{error}</p>
                  <button
                    onClick={fetchRepository}
                    className="px-4 py-2 mt-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors text-sm font-medium"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : (
              <AIChatInterface repositoryContext={repositoryContext} />
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
