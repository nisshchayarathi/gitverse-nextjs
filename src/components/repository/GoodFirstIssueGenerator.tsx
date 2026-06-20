"use client";

import { useMemo, useState } from "react";
import {
  Lightbulb,
  ChevronDown,
  ChevronUp,
  FileCode,
  AlertCircle,
  Zap,
  CheckCircle,
  Copy,
  ExternalLink,
  Filter,
  Sparkles,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  EmptyState,
  Button,
  LoadingSpinner,
  Badge,
} from "@/components/ui";
import { generateGoodFirstIssues, getIssuesByDifficulty } from "@/services/issueGeneratorService";
import { RepositoryAnalysisData } from "@/types/contributionPath";
import { RepositoryFile } from "@/types/firstPRSimulator";
import { GeneratedIssue, DifficultyCategory } from "@/types/generatedIssue";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface GoodFirstIssueGeneratorProps {
  repository?: RepositoryAnalysisData | null;
  loading?: boolean;
}

const difficultyConfig: Record<
  DifficultyCategory,
  { color: string; bgColor: string; icon: React.ReactNode }
> = {
  Beginner: {
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-900/10",
    icon: <Sparkles className="w-4 h-4" />,
  },
  Intermediate: {
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 dark:bg-yellow-900/10",
    icon: <Zap className="w-4 h-4" />,
  },
  Advanced: {
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-900/10",
    icon: <AlertCircle className="w-4 h-4" />,
  },
};

const opportunityTypeEmoji: Record<string, string> = {
  "missing-tests": "🧪",
  "dead-code": "🧹",
  refactoring: "♻️",
  documentation: "📚",
  "ui-consistency": "🎨",
  "type-safety": "🛡️",
  performance: "⚡",
  accessibility: "♿",
};

const IssueCard = ({ issue, onCopyMarkdown }: { issue: GeneratedIssue; onCopyMarkdown: (body: string) => void }) => {
  const [expanded, setExpanded] = useState(false);
  const difficulty = issue.difficulty;
  const config = difficultyConfig[difficulty];

  return (
    <Card className="glass hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={`${config.bgColor} ${config.color} border-0`}>
                <span className="mr-1">{config.icon}</span>
                {difficulty}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {opportunityTypeEmoji[issue.opportunity.type]} {issue.opportunity.type}
              </Badge>
            </div>
            <CardTitle className="text-base leading-tight">{issue.title}</CardTitle>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 p-1 hover:bg-secondary rounded transition-colors"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        <p className="text-sm text-muted-foreground mb-4">{issue.description}</p>

        <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
          <div className="bg-secondary/50 rounded p-2">
            <div className="text-muted-foreground">Effort</div>
            <div className="font-semibold capitalize">{issue.estimatedEffort}</div>
          </div>
          <div className="bg-secondary/50 rounded p-2">
            <div className="text-muted-foreground">Hours</div>
            <div className="font-semibold">{issue.estimatedHours}h</div>
          </div>
          <div className="bg-secondary/50 rounded p-2">
            <div className="text-muted-foreground">Confidence</div>
            <div className="font-semibold">{Math.round(issue.confidence * 100)}%</div>
          </div>
        </div>

        {issue.affectedFiles.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-muted-foreground mb-2">Affected Files:</div>
            <div className="flex flex-wrap gap-1">
              {issue.affectedFiles.slice(0, 3).map((file, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  <FileCode className="w-3 h-3 mr-1" />
                  {file.split("/").pop()}
                </Badge>
              ))}
              {issue.affectedFiles.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{issue.affectedFiles.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {expanded && (
          <div className="border-t pt-4 space-y-4">
            <div>
              <h4 className="text-xs font-semibold mb-2">Acceptance Criteria:</h4>
              <ul className="text-xs space-y-1">
                {issue.acceptanceCriteria.map((criterion, idx) => (
                  <li key={idx} className="flex gap-2">
                    <CheckCircle className="w-3 h-3 mt-0.5 text-green-600 flex-shrink-0" />
                    <span>{criterion}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold mb-2">Suggested Labels:</h4>
              <div className="flex flex-wrap gap-1">
                {issue.suggestedLabels.map((label, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {label}
                  </Badge>
                ))}
              </div>
            </div>

            {issue.resources && issue.resources.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold mb-2">Resources:</h4>
                <div className="text-xs space-y-1">
                  {issue.resources.map((resource, idx) => (
                    <div key={idx} className="text-muted-foreground">
                      {resource}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-secondary/30 rounded p-3">
              <h4 className="text-xs font-semibold mb-2">Issue Preview:</h4>
              <div className="text-xs max-h-32 overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h2: ({ node, ...props }) => (
                      <h2 className="text-xs font-bold mt-2 mb-1" {...props} />
                    ),
                    h3: ({ node, ...props }) => (
                      <h3 className="text-xs font-semibold mt-1 mb-1" {...props} />
                    ),
                    p: ({ node, ...props }) => <p className="text-xs mb-1" {...props} />,
                    li: ({ node, ...props }) => <li className="text-xs ml-4 list-disc" {...props} />,
                    ol: ({ node, ...props }) => <ol className="text-xs ml-4 list-decimal" {...props} />,
                    ul: ({ node, ...props }) => <ul className="text-xs ml-4 list-disc" {...props} />,
                  }}
                >
                  {issue.body}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="border-t py-3">
        <div className="flex gap-2 w-full">
          <Button
            size="sm"
            variant="ghost"
            className="flex-1"
            onClick={() => onCopyMarkdown(issue.body)}
          >
            <Copy className="w-4 h-4 mr-1" />
            Copy
          </Button>
          <Button size="sm" variant="outline" className="flex-1">
            <ExternalLink className="w-4 h-4 mr-1" />
            Create Issue
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export function GoodFirstIssueGenerator({
  repository,
  loading = false,
}: GoodFirstIssueGeneratorProps) {
  const files = useMemo(() => (repository?.files || []) as RepositoryFile[], [repository?.files]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyCategory | "all">("all");
  const [showTips, setShowTips] = useState(true);

  const issues = useMemo(() => {
    if (!repository || !files.length) return [];

    const allIssues = generateGoodFirstIssues(repository as any);

    if (selectedDifficulty === "all") return allIssues;
    return allIssues.filter((issue) => issue.difficulty === selectedDifficulty);
  }, [repository, files, selectedDifficulty]);

  const stats = useMemo(() => {
    if (!repository || !files.length) return null;
    const allIssues = generateGoodFirstIssues(repository as any);
    return {
      total: allIssues.length,
      beginner: allIssues.filter((i) => i.difficulty === "Beginner").length,
      intermediate: allIssues.filter((i) => i.difficulty === "Intermediate").length,
      advanced: allIssues.filter((i) => i.difficulty === "Advanced").length,
    };
  }, [repository, files]);

  const handleCopyMarkdown = (body: string) => {
    navigator.clipboard.writeText(body);
    // Could add toast notification here
  };

  if (loading) {
    return (
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            <CardTitle>Good First Issue Generator</CardTitle>
          </div>
          <CardDescription>
            Automatically generate contributor-friendly issues from repository analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner message="Analyzing repository opportunities…" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!repository || !files.length) {
    return (
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            <CardTitle>Good First Issue Generator</CardTitle>
          </div>
          <CardDescription>
            Automatically generate contributor-friendly issues from repository analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<Lightbulb className="w-12 h-12" />}
            title="No Repository Data"
            description="Complete a repository analysis to generate good first issues"
          />
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            <CardTitle>Good First Issue Generator</CardTitle>
          </div>
          <CardDescription>
            Automatically generate contributor-friendly issues from repository analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<Sparkles className="w-12 h-12" />}
            title="No Issues Found"
            description="Repository appears to be in good shape! No immediate opportunities detected."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              <div>
                <CardTitle>Good First Issue Generator</CardTitle>
                <CardDescription>
                  Automatically generate contributor-friendly issues from repository analysis
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {showTips && (
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex gap-3">
              <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 dark:text-blue-100 flex-1">
                <p className="font-semibold mb-1">Creating good first issues attracts contributors!</p>
                <p className="text-xs">
                  These auto-generated issues are starting points. Customize them with your project context for best results.
                </p>
              </div>
              <button
                onClick={() => setShowTips(false)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 text-xs font-semibold"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="grid grid-cols-4 gap-3">
            <Button
              variant={selectedDifficulty === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDifficulty("all")}
              className="justify-center"
            >
              <span className="text-xs">All ({stats.total})</span>
            </Button>
            <Button
              variant={selectedDifficulty === "Beginner" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDifficulty("Beginner")}
              className="justify-center text-green-600 dark:text-green-400"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              <span className="text-xs">Beginner ({stats.beginner})</span>
            </Button>
            <Button
              variant={selectedDifficulty === "Intermediate" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDifficulty("Intermediate")}
              className="justify-center text-yellow-600 dark:text-yellow-400"
            >
              <Zap className="w-3 h-3 mr-1" />
              <span className="text-xs">Intermediate ({stats.intermediate})</span>
            </Button>
            <Button
              variant={selectedDifficulty === "Advanced" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDifficulty("Advanced")}
              className="justify-center text-red-600 dark:text-red-400"
            >
              <AlertCircle className="w-3 h-3 mr-1" />
              <span className="text-xs">Advanced ({stats.advanced})</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {issues.length === 0 ? (
        <EmptyState
          icon={<Filter className="w-12 h-12" />}
          title="No Issues in This Category"
          description={`No ${selectedDifficulty.toLowerCase()} level issues found. Try selecting a different difficulty level.`}
        />
      ) : (
        <div className="grid gap-4">
          {issues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onCopyMarkdown={handleCopyMarkdown}
            />
          ))}
        </div>
      )}
    </div>
  );
}
