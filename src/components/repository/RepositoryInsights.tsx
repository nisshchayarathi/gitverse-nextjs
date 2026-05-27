import { CommitActivityHeatmap } from '@/components/visualizations/CommitActivityHeatmap'
import { CodeDependencyGraph } from '@/components/visualizations/CodeDependencyGraph'
import { LanguageDistributionChart } from '@/components/visualizations/LanguageDistributionChart'
import { CodeMetrics } from './CodeMetrics'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

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
