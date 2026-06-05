import { ChangeSizeEstimate, FilePrediction, IssueAnalysisResult, RepositoryMetadata } from "@/types/firstPRSimulator";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const estimateChangeSize = (
  predictedFiles: FilePrediction[],
  repository?: RepositoryMetadata,
  issueAnalysis?: IssueAnalysisResult,
): { changeSize: ChangeSizeEstimate; estimatedLines: number } => {
  const fileCount = predictedFiles.length;
  const averageLines = predictedFiles.reduce((sum, file) => sum + (repository?.files?.find((repoFile) => repoFile.path === file.path)?.lines ?? 40), 0) / Math.max(1, fileCount);
  const baseEstimate = Math.max(20, Math.round(fileCount * Math.max(averageLines, 30) * 0.35));

  let sizeIndex = fileCount;
  const labels = issueAnalysis?.affectedAreas.join(" ").toLowerCase() ?? "";

  if (labels.includes("refactor") || labels.includes("database") || labels.includes("security")) {
    sizeIndex += 1;
  }
  if (labels.includes("ui")) {
    sizeIndex += 0.5;
  }

  const estimatedLines = clamp(baseEstimate + fileCount * 8, 15, 250);

  if (sizeIndex <= 2) {
    return { changeSize: "Small", estimatedLines };
  }
  if (sizeIndex <= 4) {
    return { changeSize: "Medium", estimatedLines }; 
  }

  return { changeSize: "Large", estimatedLines };
};
