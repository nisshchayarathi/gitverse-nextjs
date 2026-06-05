import {
  DifficultyLevel,
  FilePrediction,
  IssueAnalysisResult,
  RepositoryMetadata,
} from "@/types/firstPRSimulator";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const calculateDifficulty = (
  predictedFiles: FilePrediction[],
  repository?: RepositoryMetadata,
  issueAnalysis?: IssueAnalysisResult,
): DifficultyLevel => {
  const fileCount = predictedFiles.length;
  const repoSize = repository?.files?.length ?? 0;
  const labelText = issueAnalysis?.affectedAreas.join(" ").toLowerCase() ?? "";

  let score = fileCount * 7;
  score += clamp(repoSize / 50, 0, 20);

  if (labelText.includes("security") || labelText.includes("performance") || labelText.includes("database")) {
    score += 12;
  }
  if (labelText.includes("ui") || labelText.includes("frontend") || labelText.includes("dashboard")) {
    score += 4;
  }
  if (labelText.includes("api") || labelText.includes("backend")) {
    score += 8;
  }

  if (repository?.languages?.some((language) => language.name.toLowerCase().includes("sql"))) {
    score += 5;
  }

  if (issueAnalysis?.keywords.some((keyword) => keyword.includes("refactor") || keyword.includes("cleanup"))) {
    score += 8;
  }

  if (score < 20) {
    return "Beginner";
  }
  if (score < 40) {
    return "Intermediate";
  }

  return "Advanced";
};

export const estimateArchitecturalComplexity = (repository?: RepositoryMetadata) => {
  const repoSize = repository?.files?.length ?? 0;
  if (repoSize > 450) {
    return "High";
  }
  if (repoSize > 200) {
    return "Moderate";
  }
  return "Low";
};
