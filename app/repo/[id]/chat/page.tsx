"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
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

  useEffect(() => {
    fetchRepository();
  }, [id]);

  const fetchRepository = async () => {
    if (!id) return;
    try {
      const token = localStorage.getItem("gitverse_token");
      const response = await axios.get(
        buildApiUrl(`/api/repositories/${id}`),
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const repo = response.data.repository || response.data;
      setRepository(repo);
    } catch (err) {
      console.error("Error fetching repository:", err);
    } finally {
      setLoading(false);
    }
  };

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
            ) : (
              <AIChatInterface repositoryContext={repositoryContext} />
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
