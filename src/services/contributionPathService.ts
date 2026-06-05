import {
  buildLearningMap,
} from "@/utils/repositoryLearningMap";
import {
  buildMilestones,
  findBeginnerIssues,
  generateContributionRoadmap,
  recommendFilesForContribution,
} from "@/utils/pathGenerator";
import {
  ContributionPathPlan,
  ContributionPreference,
  RepositoryAnalysisData,
} from "@/types/contributionPath";

const estimateScore = (
  preference: ContributionPreference,
  repository?: RepositoryAnalysisData,
) => {
  const base = preference.experienceLevel === "Beginner" ? 60 : preference.experienceLevel === "Intermediate" ? 75 : 90;
  const coverageBonus = Math.min(20, (repository?.files?.length || 0) / 15);
  return Math.min(100, Math.round(base + coverageBonus));
};

const buildProfile = (
  preference: ContributionPreference,
  repository?: RepositoryAnalysisData,
) => {
  const score = estimateScore(preference, repository);
  const badge =
    score >= 90
      ? "Contributor Champion"
      : score >= 75
      ? "Pathfinder"
      : "Explorer";

  return {
    name: preference.name || "Contributor",
    experienceLevel: preference.experienceLevel,
    focusArea: preference.focusArea,
    score,
    badge,
  };
};

export const buildContributionPathPlan = (
  preference: ContributionPreference,
  repository?: RepositoryAnalysisData,
): ContributionPathPlan => {
  const profile = buildProfile(preference, repository);
  const recommendedFiles = recommendFilesForContribution(repository, preference.focusArea);
  const learningConcepts = buildLearningMap(repository, preference.focusArea);
  const roadmap = generateContributionRoadmap(preference.experienceLevel, preference.focusArea, repository);
  const recommendedIssues = findBeginnerIssues(repository, preference.focusArea);
  const milestones = buildMilestones(preference.experienceLevel, preference.focusArea);
  const progress = Math.min(100, Math.round(profile.score * 0.9));
  const badges = [profile.badge, `${preference.focusArea} Pathfinder`, `${preference.experienceLevel} Learner`];
  const summary = `A ${preference.experienceLevel} ${preference.focusArea} contributor roadmap designed to help you onboard and make your first contribution quickly.`;

  const firstContributionOpportunities = [
    `Review ${recommendedFiles[0]?.path || "core repository files"} and make a small documentation or bug-fix contribution.`,
    `Select a beginner-friendly issue and propose a scoped pull request.`,
    `Improve repository examples, tests, or onboarding guides in the ${preference.focusArea} area.`,
  ];

  return {
    profile,
    roadmap,
    recommendedFiles,
    learningConcepts,
    recommendedIssues,
    firstContributionOpportunities,
    milestones,
    completionScore: progress,
    progress,
    badges,
    summary,
    aiAssistantHint: "Future AI integration can generate personalized learning plans and contribution prompts based on this roadmap.",
    futureAIReady: true,
  };
};
