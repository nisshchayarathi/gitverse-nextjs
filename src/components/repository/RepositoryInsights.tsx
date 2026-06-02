import { CommitActivityHeatmap } from '@/components/visualizations/CommitActivityHeatmap'
import { CodeDependencyGraph } from '@/components/visualizations/CodeDependencyGraph'
import { LanguageDistributionChart } from '@/components/visualizations/LanguageDistributionChart'
import { CodeMetrics } from './CodeMetrics'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { useState } from 'react'
import { toast } from '@/hooks/use-toast'
import axios from 'axios'

import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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

  const downloadPNG = async () => {
    const element = document.getElementById("repo-analysis");

    if (!element) return;

    const canvas = await html2canvas(element);

    const link = document.createElement("a");

    link.download = "repository-analysis.png";

    link.href = canvas.toDataURL("image/png");

    link.click();
  };

  const downloadPDF = async () => {
    const element = document.getElementById("repo-analysis");

    if (!element) return;

    const canvas = await html2canvas(element);

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");

    const pdfWidth = 210;

    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

    pdf.save("repository-analysis.pdf");
  };

  const generateArchitectureMarkdown = async () => {
    if (!repository?.id) return;

    setIsGeneratingMd(true);
    try {
      const token = localStorage.getItem("gitverse_token");
      const response = await axios.post(
        `/api/repositories/${repository.id}/generate-architecture`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "text",
        }
      );

      const blob = new Blob([response.data], { type: "text/markdown;charset=utf-8;" });
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

      toast({
        title: "Success",
        description: "ARCHITECTURE.md Downloaded successfully!"
      });
    } catch (error: any) {
      console.error("MD Generation Error", error);
      toast({
        title: "Export failed",
        description: error.response?.data?.error || "Failed to generate architecture document.",
        variant: "destructive"
      });
    } finally {
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
            {isGeneratingMd ? "Generating..." : "Export ARCHITECTURE.md"}
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

    </div>
  )
}
