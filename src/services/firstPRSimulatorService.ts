import { analyzeIssue } from "@/utils/issueAnalyzer";
import { predictFiles } from "@/utils/filePrediction";
import { calculateDifficulty } from "@/utils/difficultyCalculator";
import { estimateChangeSize } from "@/utils/sizeEstimator";
import {
  ChangeSizeEstimate,
  FirstPRRoadmap,
  FirstPRSimulatorResult,
  IssueData,
  RepositoryMetadata,
} from "@/types/firstPRSimulator";

const buildStartingPoint = (
  predictedFiles: FirstPRSimulatorResult["predictedFiles"],
  issueAnalysis: ReturnType<typeof analyzeIssue>,
): FirstPRRoadmap => {
  const topFile = predictedFiles[0];
  const startHere = topFile?.path ?? "repository root";
  const reason = topFile
    ? `Start by reviewing ${topFile.path} because it has the strongest alignment with the issue keywords and likely area.`
    : `Begin by reviewing the issue description and the repository structure to identify the best entry point.`;

  const steps = [
    `Review the issue summary and affected areas: ${issueAnalysis.summary}`,
    `Open ${startHere} and trace existing behavior around the predicted change area.`,
    `Add targeted tests for the predicted files and verify that changes respect repository conventions.`,
  ];

  return {
    startHere,
    reason,
    steps,
  };
};

const generateSuggestedTests = (
  issueAnalysis: ReturnType<typeof analyzeIssue>,
  difficulty: string,
): string[] => {
  const suggestions = new Set<string>();

  if (issueAnalysis.affectedAreas.some((area) => area.toLowerCase().includes("api"))) {
    suggestions.add("Add API contract tests for endpoint behavior.");
  }
  if (issueAnalysis.affectedAreas.some((area) => area.toLowerCase().includes("user interface"))) {
    suggestions.add("Add component rendering tests for impacted UI paths.");
  }
  if (issueAnalysis.affectedAreas.some((area) => area.toLowerCase().includes("security"))) {
    suggestions.add("Add authentication or authorization regression tests.");
  }
  if (issueAnalysis.affectedAreas.some((area) => area.toLowerCase().includes("performance"))) {
    suggestions.add("Add performance benchmark tests for the affected endpoints.");
  }
  if (difficulty === "Advanced") {
    suggestions.add("Add integration tests that cover the full change flow.");
  }
  if (!suggestions.size) {
    suggestions.add("Add focused unit tests for the predicted change area.");
  }

  return Array.from(suggestions).slice(0, 4);
};

const buildConfidence = (
  issueAnalysisConfidence: number,
  predictedFiles: FirstPRSimulatorResult["predictedFiles"],
  changeSize: ChangeSizeEstimate,
) => {
  const fileConfidence = predictedFiles.length > 0 ? 10 : -10;
  const sizeConfidence = changeSize === "Medium" ? 5 : 0;
  return Math.min(100, Math.max(0, issueAnalysisConfidence + fileConfidence + sizeConfidence));
};

export const generateFirstPRSimulator = (
  issue: IssueData,
  repository?: RepositoryMetadata,
): FirstPRSimulatorResult => {
  const issueAnalysis = analyzeIssue(issue, repository);
  const predictedFiles = predictFiles(issueAnalysis, repository?.files || [], repository);
  const difficulty = calculateDifficulty(predictedFiles, repository, issueAnalysis);

  const { changeSize, estimatedLines } = estimateChangeSize(predictedFiles, repository, issueAnalysis);
  const suggestedTests = generateSuggestedTests(issueAnalysis, difficulty);
  const startingPoint = buildStartingPoint(predictedFiles, issueAnalysis);
  const confidence = buildConfidence(issueAnalysis.confidence, predictedFiles, changeSize);

  const roadmapSteps = [
    `Analyze the issue keywords and labels to confirm the predicted impact area.`,
    `Inspect ${startingPoint.startHere} and the top predicted file set for the first changes.`,
    `Add tests that validate the expected behavior for the chosen files and affected area.`,
  ];

  const notes = [];
  if (predictedFiles.length === 0) {
    notes.push(
      "No strong file matches were found. Use the repository search to locate the most relevant code paths manually.",
    );
  }
  if (issueAnalysis.affectedAreas.includes("Database") || issueAnalysis.affectedAreas.includes("API Services")) {
    notes.push("Review related backend and schema dependencies before making the first PR.");
  }

  return {
    issueAnalysis,
    predictedFiles,
    difficulty,
    changeSize,
    estimatedLines,
    startingPoint,
    suggestedTests,
    confidence,
    roadmapSteps,
    notes,
  };
};
