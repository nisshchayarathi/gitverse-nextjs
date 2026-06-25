import { RepositoryAnalysisData } from "@/types/contributionPath";
import {
  ContributorJourneyCategory,
  ContributorJourneyConfig,
  ContributorJourneyResult,
  ContributorJourneyStep,
  ContributorExperienceLevel,
  CONTRIBUTOR_JOURNEY_CATEGORIES,
} from "@/types/contributorJourney";
import { getFolderImportance } from "@/config/folderImportance";

const CATEGORY_PATTERNS: Record<ContributorJourneyCategory, RegExp[]> = {
  Authentication: [
    /auth/i,
    /oauth/i,
    /login/i,
    /signin/i,
    /signup/i,
    /session/i,
    /provider/i,
  ],
  "API Layer": [
    /api\//i,
    /endpoint/i,
    /route/i,
    /controller/i,
    /server/i,
    /request/i,
  ],
  "Frontend UI": [
    /component/i,
    /page/i,
    /ui/i,
    /layout/i,
    /theme/i,
    /style/i,
    /modal/i,
  ],
  "State Management": [
    /context/i,
    /store/i,
    /state/i,
    /reducer/i,
    /hook/i,
    /atom/i,
  ],
  "Database Layer": [
    /prisma/i,
    /schema/i,
    /model/i,
    /db/i,
    /migration/i,
    /repository/i,
  ],
  "Repository Analysis Features": [
    /analysis/i,
    /insight/i,
    /metric/i,
    /hotspot/i,
    /report/i,
    /repository/i,
  ],
  "Custom Feature Requests": [
    /feature/i,
    /request/i,
    /change/i,
    /improve/i,
  ],
};

const ENTRY_POINT_PATTERNS = [
  /(^|\/)app\/(layout|page)\.(tsx|ts|js|jsx)$/i,
  /(^|\/)pages\/(\_app|index|api)\.(tsx|ts|js|jsx)$/i,
  /(^|\/)middleware\.(tsx|ts|js|jsx)$/i,
  /(^|\/)src\/(app|pages)\//i,
];

const COMMON_IMPORTANCE_PATTERNS: RegExp[] = [
  /auth/i,
  /middleware/i,
  /api/i,
  /service/i,
  /controller/i,
  /store/i,
  /context/i,
  /prisma/i,
  /schema/i,
];

const EXPERIENCE_BASE_MULTIPLIER: Record<ContributorExperienceLevel, number> = {
  Beginner: 0.8,
  Intermediate: 1,
  Advanced: 1.1,
  Expert: 1.2,
};

function normalizePath(filePath: string): string {
  return String(filePath || "").replace(/\\/g, "/").toLowerCase();
}

function inferJourneyCategory(goal: string): ContributorJourneyCategory {
  const normalizedGoal = goal.toLowerCase();

  for (const category of CONTRIBUTOR_JOURNEY_CATEGORIES) {
    const patterns = CATEGORY_PATTERNS[category];
    if (patterns.some((pattern) => pattern.test(normalizedGoal))) {
      return category;
    }
  }

  if (/oauth|login|signin|signup|session|auth/i.test(goal)) {
    return "Authentication";
  }
  if (/api|endpoint|backend|server|route/i.test(goal)) {
    return "API Layer";
  }
  if (/ui|component|frontend|page|layout/i.test(goal)) {
    return "Frontend UI";
  }
  if (/state|context|redux|store|hook/i.test(goal)) {
    return "State Management";
  }
  if (/database|db|prisma|schema|migration/i.test(goal)) {
    return "Database Layer";
  }

  return "Custom Feature Requests";
}

function buildSegmentFrequency(files: Array<{ path?: string }>): Record<string, number> {
  const frequency: Record<string, number> = {};

  files.forEach((file) => {
    const normalized = normalizePath(file.path || "");
    const segments = normalized.split("/").filter(Boolean);
    segments.forEach((segment) => {
      if (segment.length > 1) {
        frequency[segment] = (frequency[segment] || 0) + 1;
      }
    });
  });

  return frequency;
}

function computeCommitSignal(filePath: string, commitMessages: Array<{ message?: string }> = []): number {
  const normalizedPath = normalizePath(filePath);
  const parts = normalizedPath.split("/").filter(Boolean);
  const keywords = new Set(parts.slice(-2));

  let score = 0;
  commitMessages.forEach((commit) => {
    const message = String(commit.message || "").toLowerCase();
    keywords.forEach((keyword) => {
      if (keyword && message.includes(keyword)) {
        score += 1;
      }
    });
  });

  return Math.min(5, score);
}

function buildFileReason(
  path: string,
  category: ContributorJourneyCategory,
  score: number,
): string {
  const normalized = normalizePath(path);

  if (ENTRY_POINT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "Detected as an application entry point or routing start.";
  }

  if (CATEGORY_PATTERNS[category].some((pattern) => pattern.test(normalized))) {
    return `Core ${category.toLowerCase()} file identified through path and naming signals.`;
  }

  if (/middleware/i.test(normalized)) {
    return "Request pipeline or authorization middleware file.";
  }

  if (/auth/i.test(normalized)) {
    return "Authentication-related file that is important for security and user flows.";
  }

  if (/prisma|schema|db|migration/i.test(normalized)) {
    return "Database layer or model file relevant to persistence and schema.";
  }

  if (/component|page|layout|ui|style/i.test(normalized)) {
    return "Frontend user interface file that shapes the contributor experience.";
  }

  if (score > 70) {
    return "Highly central repository file with many connections to other modules.";
  }

  return "Strong candidate selected based on repository structure and contributor importance.";
}

function determineDifficulty(score: number, fileSize: number): "Easy" | "Moderate" | "Hard" {
  if (score > 75 || fileSize > 150_000) {
    return "Hard";
  }
  if (score > 45 || fileSize > 60_000) {
    return "Moderate";
  }
  return "Easy";
}

function estimateStepTime(score: number, fileSize: number): number {
  const sizeMinutes = Math.min(12, Math.max(2, Math.round((fileSize || 20_000) / 18_000)));
  const scoreMinutes = Math.round(Math.max(1, score / 20));
  return Math.max(5, Math.min(18, sizeMinutes + scoreMinutes));
}

export function simulateContributorJourney(
  repository?: RepositoryAnalysisData,
  config: ContributorJourneyConfig = { goal: "Understand the repository", experienceLevel: "Intermediate", maxSteps: 5 },
): ContributorJourneyResult {
  const files = repository?.files || [];
  const category = config.category || inferJourneyCategory(config.goal || "");
  const experienceLevel: ContributorExperienceLevel = config.experienceLevel || "Intermediate";
  const maxSteps = Math.max(3, Math.min(12, config.maxSteps || 5));
  const segmentFrequency = buildSegmentFrequency(files);

  const scoredFiles = files.map((file) => {
    const path = String(file.path || "");
    const normalized = normalizePath(path);
    const folder = normalized.split("/")[0] || "root";
    const size = Number(file.size || 32_000);

    let score = 20;

    if (ENTRY_POINT_PATTERNS.some((pattern) => pattern.test(normalized))) {
      score += 28;
    }

    if (/middleware/i.test(normalized)) {
      score += 18;
    }

    const folderImportance = getFolderImportance(folder);
    score += (folderImportance?.level ?? 2) * 6;

    if (COMMON_IMPORTANCE_PATTERNS.some((pattern) => pattern.test(normalized))) {
      score += 14;
    }

    const categoryMatches = CATEGORY_PATTERNS[category].reduce(
      (count, pattern) => count + (pattern.test(normalized) ? 1 : 0),
      0,
    );
    score += categoryMatches * 12;

    if (category === "Authentication" && /(^|\/)auth\.(ts|tsx|js|jsx)$/.test(normalized)) {
      score += 28;
    }

    if (category === "Authentication" && /auth|login|signin|signup|session|oauth|provider/i.test(normalized)) {
      score += 20;
    }

    score += Math.min(18, (segmentFrequency[folder] || 0) * 2);
    score += computeCommitSignal(normalized, repository?.commits) * 4;

    score += Math.min(18, Math.round(size / 20_000));
    score += normalized.endsWith(".tsx") || normalized.endsWith(".jsx") ? 5 : 2;
    score *= EXPERIENCE_BASE_MULTIPLIER[experienceLevel];

    return {
      path,
      score: Math.round(score),
      size,
    };
  });

  const ranked = scoredFiles
    .filter((file) => file.path && !file.path.endsWith(".d.ts"))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, maxSteps);

  const learningPath: ContributorJourneyStep[] = ranked.map((file) => ({
    file: file.path,
    reason: buildFileReason(file.path, category, file.score),
    category,
    difficulty: determineDifficulty(file.score, file.size),
    estimatedTimeMinutes: estimateStepTime(file.score, file.size),
  }));

  const estimatedTime = Math.max(
    10,
    Math.round(
      learningPath.reduce((sum, step) => sum + step.estimatedTimeMinutes * 0.8, 0),
    ),
  );

  const notes = [
    `Inferred category: ${category}.`,
    "Paths are ranked using folder importance, entry points, category relevance, and commit activity.",
    `Estimated time accounts for file complexity and repository scale for ${experienceLevel} contributors.`,
  ];

  if (files.length === 0) {
    notes.unshift("No repository files were available to analyze. Using a default learning path.");
  }

  return {
    goal: config.goal || "Understand the repository",
    category,
    estimatedTime,
    learningPath,
    notes,
    repository,
  };
}
