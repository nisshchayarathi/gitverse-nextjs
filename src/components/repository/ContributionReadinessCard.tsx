import React from 'react';
import {
  Code,
  FileText,
  TestTube,
  TrendingUp,
} from 'lucide-react';
import {
  calculateContributionReadiness,
  getIndicatorColor,
  getIndicatorBgColor,
  getIndicatorEmoji,
  ContributionReadinessScore,
} from '@/lib/utils/contributionReadinessScore';

interface ContributionReadinessCardProps {
  file: any;
  repository: any;
}

export const ContributionReadinessCard: React.FC<ContributionReadinessCardProps> = ({
  file,
  repository,
}) => {
  const readiness = calculateContributionReadiness(file, repository);

  const getStatusBadgeClass = () => {
    const baseClass = 'inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium';
    return `${baseClass} ${getIndicatorBgColor(readiness.indicator)} ${getIndicatorColor(readiness.indicator)}`;
  };

  const getAttributeBadgeClass = (value: string) => {
    const colorMap: Record<string, string> = {
      'Low': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Medium': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'High': 'bg-red-500/20 text-red-400 border-red-500/30',
      'Complete': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Partial': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'Missing': 'bg-red-500/20 text-red-400 border-red-500/30',
      'Available': 'bg-green-500/20 text-green-400 border-green-500/30',
    };
    
    const color = colorMap[value] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    return `inline-block px-2 py-1 rounded text-xs font-medium border ${color}`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Contribution Readiness
        </h3>
        <div className={getStatusBadgeClass()}>
          <span>{getIndicatorEmoji(readiness.indicator)}</span>
          <span>{readiness.indicator}</span>
        </div>
      </div>

      {/* Readiness Score */}
      <div className="bg-white/5 rounded-lg p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-wide">
              Readiness Score
            </p>
            <p className="text-4xl font-bold mt-2">{readiness.percentage}%</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground mb-2">Overall</p>
            <div className="h-24 w-24 rounded-full border-4 border-white/10 flex items-center justify-center bg-white/5">
              <div className="text-center">
                <p className="text-2xl font-bold">{readiness.percentage}</p>
                <p className="text-xs text-muted-foreground">%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-300"
            style={{
              width: `${readiness.percentage}%`,
              background:
                readiness.percentage >= 80
                  ? 'linear-gradient(to right, rgb(34, 197, 94))'
                  : readiness.percentage >= 50
                  ? 'linear-gradient(to right, rgb(234, 179, 8))'
                  : 'linear-gradient(to right, rgb(239, 68, 68))',
            }}
          />
        </div>
      </div>

      {/* Attributes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Complexity */}
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <Code className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Complexity
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">
              {readiness.complexity}
            </span>
            <span className={getAttributeBadgeClass(readiness.complexity)}>
              +{readiness.breakdown.complexity}
            </span>
          </div>
        </div>

        {/* Documentation */}
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-green-400" />
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Documentation
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">
              {readiness.documentation}
            </span>
            <span className={getAttributeBadgeClass(readiness.documentation)}>
              +{readiness.breakdown.documentation}
            </span>
          </div>
        </div>

        {/* Test Coverage */}
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <TestTube className="h-4 w-4 text-purple-400" />
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Test Coverage
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">
              {readiness.tests}
            </span>
            <span className={getAttributeBadgeClass(readiness.tests)}>
              +{readiness.breakdown.tests}
            </span>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-orange-400" />
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Recent Activity
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">
              {readiness.breakdown.recentActivity > 0 ? 'Yes' : 'No'}
            </span>
            <span className={getAttributeBadgeClass(readiness.breakdown.recentActivity > 0 ? 'Available' : 'Missing')}>
              +{readiness.breakdown.recentActivity}
            </span>
          </div>
        </div>
      </div>

      {/* Score Interpretation */}
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">What does this mean?</span>
          {' '}
          {readiness.indicator === 'Ready' && 'This module is well-structured, documented, and tested. It\'s ready for contribution with clear guidelines.'}
          {readiness.indicator === 'Moderate' && 'This module has some documentation and tests but could benefit from additional coverage or refactoring before contribution.'}
          {readiness.indicator === 'Challenging' && 'This module would benefit from better documentation, more tests, and refactoring. Consider addressing these areas before contributing.'}
        </p>
      </div>
    </div>
  );
};

export default ContributionReadinessCard;
