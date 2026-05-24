import { CommitActivityHeatmap } from '@/components/visualizations/CommitActivityHeatmap'
import { CodeDependencyGraph } from '@/components/visualizations/CodeDependencyGraph'
import { LanguageDistributionChart } from '@/components/visualizations/LanguageDistributionChart'
import { CodeMetrics } from './CodeMetrics'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

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
  branches?: any[]
  size: number;
}

interface RepositoryInsightsProps {
  repository?: RepositoryData;
}

export function RepositoryInsights({ repository }: RepositoryInsightsProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Repository Insights</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Advanced visualizations and metrics powered by D3.js
        </p>
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
