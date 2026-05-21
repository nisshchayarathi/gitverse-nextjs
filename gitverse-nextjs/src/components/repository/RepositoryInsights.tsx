import { CommitActivityHeatmap } from '@/components/visualizations/CommitActivityHeatmap'
import { CodeDependencyGraph } from '@/components/visualizations/CodeDependencyGraph'
import { LanguageDistributionChart } from '@/components/visualizations/LanguageDistributionChart'
import { CodeMetrics } from './CodeMetrics'

interface RepositoryInsightsProps {
  repository?: any
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
      <CommitActivityHeatmap repository={repository} />

      {/* Language Distribution */}
      <LanguageDistributionChart repository={repository} />

      {/* Code Dependency Graph */}
      <CodeDependencyGraph repository={repository} />

      {/* Code Metrics Section */}
      <CodeMetrics repository={repository} />
    </div>
  )
}
