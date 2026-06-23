import { CommitActivityHeatmap } from '@/components/visualizations/CommitActivityHeatmap'
import { CodeDependencyGraph } from '@/components/visualizations/CodeDependencyGraph'
import { LanguageDistributionChart } from '@/components/visualizations/LanguageDistributionChart'
import { CodeMetrics } from './CodeMetrics'
import RepositoryLearningPath from "./RepositoryLearningPath";
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import RepositoryEvolutionTimeline from "./RepositoryEvolutionTimeline";
import ContributorIssueRecommendations from "../ContributorIssueRecommendations";
import DependencyVulnerabilityScanner from "./DependencyVulnerabilityScanner";
import CodeComplexityAnalyzer from "./CodeComplexityAnalyzer";
import ContributorOnboardingChatbot from "./ContributorOnboardingChatbot";
import RepositoryHealthDashboard from "./RepositoryHealthDashboard";
import ArchitectureChangeComparison from "./ArchitectureChangeComparison";
import DocumentationGenerator from "./DocumentationGenerator";
import PullRequestReviewAssistant from "./PullRequestReviewAssistant";
import { useState } from 'react'
import { toast } from '@/hooks/use-toast'
import axios from 'axios'

import { Loader2 } from "lucide-react";
import { exportElement } from '@/lib/exportUtils'

interface LanguageStat {
  name: string;
  percentage: number;
  files: number;
  lines: number;
  color: string;
}

interface FileTypeStat {
  type: string;
  count: number;
  percentage: number;
  icon: string;
}

interface RepositoryData {
  id?: number;
  name?: string;
  url?: string;
  description?: string;
  languages: LanguageStat[];
  files: FileTypeStat[];
  commits: any[];
  contributors: any[];
  branches?: any[];
  size: number;
}

interface RepositoryInsightsProps {
  repository?: RepositoryData;
}

export function RepositoryInsights({
  repository,
}: RepositoryInsightsProps) {
  const [isGeneratingMd, setIsGeneratingMd] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);

  const downloadPNG = async () => {
    try {
      await exportElement("repo-analysis", "png", "repository-analysis");
      toast({
        title: "Success",
        description: "Repository analysis exported as PNG.",
      });
    } catch (error: any) {
      console.error("Failed to export PNG:", error);
      toast({
        title: "Export failed",
        description: error.message || "Failed to export repository analysis as PNG.",
        variant: "destructive",
      });
    }
  };

  const downloadPDF = async () => {
    try {
      await exportElement("repo-analysis", "pdf", "repository-analysis");
      toast({
        title: "Success",
        description: "Repository analysis exported as PDF.",
      });
    } catch (error: any) {
      console.error("Failed to export PDF:", error);
      toast({
        title: "Export failed",
        description: error.message || "Failed to export repository analysis as PDF.",
        variant: "destructive",
      });
    }
  };

  const generateArchitectureMarkdown = async () => {
    if (!repository?.id) return;

    const totalFiles = repository.files?.reduce((acc, curr) => acc + curr.count, 0) || 0;
    if (totalFiles > 200) {
      if (!window.confirm(`This repository has ${totalFiles} files. Generating the architecture document will process in chunks and may take several minutes. Do you want to continue?`)) {
        return;
      }
    }

    setIsGeneratingMd(true);
    setProgressMessage("Starting generation...");
    setProgressPercent(0);

    try {
      const token = localStorage.getItem("gitverse_token");
      
      // 1. Queue the background job
      const postResponse = await axios.post(
        `/api/repositories/${repository.id}/generate-architecture`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const jobId = postResponse.data.jobId;

      // 2. Poll for job completion
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await axios.get(`/api/analysis-jobs/${jobId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          const job = statusRes.data;
          
          if (job.status === "FAILED") {
            clearInterval(pollInterval);
            setIsGeneratingMd(false);
            toast({
              title: "Export failed",
              description: job.error || "Failed to generate architecture document.",
              variant: "destructive"
            });
            return;
          }
          
          if (job.status === "DONE") {
            clearInterval(pollInterval);
            
            // 3. Download the finished document
            setProgressMessage("Downloading document...");
            const getResponse = await axios.get(
              `/api/repositories/${repository.id}/generate-architecture`,
              {
                headers: { Authorization: `Bearer ${token}` },
                responseType: "text",
              }
            );

            const blob = new Blob([getResponse.data], { type: "text/markdown;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = url;
            const sanitizedName = (repository.name || "")
              .trim()
              .replace(/[\/\\?%*:|"<>]/g, "-")
              .replace(/-{2,}/g, "-")
              .replace(/^-|-$/g, "") || "repository";
            link.download = `${sanitizedName}-ARCHITECTURE.md`;
            document.body.appendChild(link);
            link.click();

            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setIsGeneratingMd(false);
            toast({
              title: "Success",
              description: "ARCHITECTURE.md Downloaded successfully!"
            });
          } else {
            // Update progress
            setProgressMessage(job.progressMessage || "Processing...");
            setProgressPercent(job.progressPercent || 0);
          }
        } catch (pollErr) {
          console.error("Error polling job", pollErr);
        }
      }, 3000);

    } catch (error: any) {
      console.error("MD Generation Error", error);
      toast({
        title: "Export failed",
        description: error.response?.data?.error || "Failed to start architecture generation.",
        variant: "destructive"
      });
      setIsGeneratingMd(false);
    }
  };

  return (
    <div id="repo-analysis" className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">

        <div>
          <h2 className="text-2xl font-bold">
            Repository Insights
          </h2>

          <p className="text-sm text-muted-foreground mt-1">
            Advanced visualizations and metrics powered by D3.js
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex gap-2">

          <button
            onClick={generateArchitectureMarkdown}
            disabled={isGeneratingMd || !repository?.id}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {isGeneratingMd ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {progressMessage} ({progressPercent}%)
              </>
            ) : (
              "Export ARCHITECTURE.md"
            )}
          </button>

          <button
            onClick={downloadPNG}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            Export PNG
          </button>

          <button
            onClick={downloadPDF}
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition"
          >
            Export PDF
          </button>

        </div>
      </div>

      {/* Commit Activity Heatmap */}
      <ErrorBoundary>
        <CommitActivityHeatmap repository={repository} />
      </ErrorBoundary>

      {/* Language Distribution */}
      <ErrorBoundary>
        <LanguageDistributionChart repository={repository} />
      </ErrorBoundary>

      {/* Code Dependency Graph */}
      <ErrorBoundary>
        <CodeDependencyGraph repository={repository} />
      </ErrorBoundary>

      {/* Code Metrics Section */}
      <CodeMetrics repository={repository} />

      {/* AI Repository Learning Path */}
      <RepositoryLearningPath repository={repository} />

      {/* Repository Evolution Timeline */}
      <RepositoryEvolutionTimeline />

      {/* Contributor Skill-Based Issue Recommendations */}
      <ContributorIssueRecommendations />

      {/* AI Code Complexity Analyzer */}
      <CodeComplexityAnalyzer />

      {/* Dependency Vulnerability Scanner */}
      <DependencyVulnerabilityScanner />

      {/* AI Contributor Onboarding Chatbot */}
      <ContributorOnboardingChatbot />

      {/* Smart Repository Health Dashboard */}
      <RepositoryHealthDashboard />

      {/* Repository Architecture Change Comparison */}
      <ArchitectureChangeComparison />

      {/* AI-Based Documentation Generator */}
      <DocumentationGenerator />

      {/* AI-Powered Pull Request Review Assistant */}
      <PullRequestReviewAssistant />

    </div>
  )
}
