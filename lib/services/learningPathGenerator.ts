import prisma from "../prisma";
import { ComplexityLevel, JourneyStatus, FileImportance } from "@prisma/client";
import { DependencyGraphService } from "./dependencyGraphService";

export interface JourneyConfig {
  moduleName: string;
  goalDescription: string;
  targetComplexity: ComplexityLevel;
  maxSteps?: number;
  startingPoints?: string[]; // Files to focus on
}

export interface GeneratedStep {
  filePath: string;
  fileName: string;
  complexity: ComplexityLevel;
  estimatedMinutes: number;
  reasoning: string;
  dependencies: string[];
  order: number;
}

export interface GeneratedJourney {
  moduleName: string;
  steps: GeneratedStep[];
  totalMinutes: number;
  estimatedDays: number;
}

export class LearningPathGenerator {
  private dependencyGraphService = new DependencyGraphService();

  /**
   * Generate a personalized learning journey for a contributor
   */
  async generateJourney(
    repositoryId: number,
    config: JourneyConfig,
  ): Promise<GeneratedJourney> {
    // Get file importance data
    const importantFiles = await prisma.fileImportance.findMany({
      where: { repositoryId },
      orderBy: { importanceScore: "desc" },
    });

    if (importantFiles.length === 0) {
      throw new Error("No file importance data found. Please analyze the repository first.");
    }

    // Filter files based on complexity and focus areas
    let candidateFiles: FileImportance[] = importantFiles;

    // Filter by target complexity
    candidateFiles = this.filterByComplexity(candidateFiles, config.targetComplexity);

    // If starting points are specified, prioritize them
    if (config.startingPoints && config.startingPoints.length > 0) {
      candidateFiles = this.prioritizeStartingPoints(candidateFiles, config.startingPoints);
    }

    // Limit the number of steps
    const maxSteps = config.maxSteps || 10;
    const selectedFiles = candidateFiles.slice(0, maxSteps);

    // Build dependency relationships
    const dependencies = await prisma.fileDependency.findMany({
      where: { repositoryId },
    });

    // Create a map for quick lookup
    const depMap = new Map<string, Set<string>>();
    for (const dep of dependencies) {
      if (!depMap.has(dep.targetFilePath)) {
        depMap.set(dep.targetFilePath, new Set());
      }
      depMap.get(dep.targetFilePath)!.add(dep.sourceFilePath);
    }

    // Generate journey steps
    const steps = await this.generateSteps(selectedFiles, depMap, config);

    // Order steps based on dependencies and complexity
    const orderedSteps = this.orderSteps(steps);

    // Calculate totals
    const totalMinutes = orderedSteps.reduce((sum, step) => sum + step.estimatedMinutes, 0);
    const estimatedDays = Math.ceil(totalMinutes / 480); // Assume 8 hours per day

    return {
      moduleName: config.moduleName,
      steps: orderedSteps,
      totalMinutes,
      estimatedDays,
    };
  }

  /**
   * Filter files by target complexity level
   */
  private filterByComplexity(
    files: FileImportance[],
    targetComplexity: ComplexityLevel,
  ) {
    const complexityOrder: Record<ComplexityLevel, number> = {
      BEGINNER: 0,
      INTERMEDIATE: 1,
      ADVANCED: 2,
      EXPERT: 3,
    };

    const targetOrder = complexityOrder[targetComplexity];

    // For a journey, include files at and below the target complexity
    return files.filter(
      (file) => complexityOrder[file.complexity] <= targetOrder,
    );
  }

  /**
   * Prioritize starting points
   */
  private prioritizeStartingPoints(
    files: FileImportance[],
    startingPoints: string[],
  ) {
    const startSet = new Set(startingPoints);
    const priority = files.filter((f) => startSet.has(f.filePath));
    const remaining = files.filter((f) => !startSet.has(f.filePath));
    return [...priority, ...remaining];
  }

  /**
   * Generate individual journey steps
   */
  private async generateSteps(
    files: FileImportance[],
    depMap: Map<string, Set<string>>,
    config: JourneyConfig,
  ): Promise<GeneratedStep[]> {
    const steps: GeneratedStep[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Use depMap if available
      const depsSet = depMap.get(file.filePath) ?? new Set<string>();
      const dependencies = Array.from(depsSet);

      // Generate reasoning for learning this file
      const reasoning = this.generateReasoning(
        file.filePath,
        file.category,
        config.moduleName,
        dependencies.length,
      );

      // Estimate time based on complexity
      const estimatedMinutes = this.estimateTime(file.complexity as ComplexityLevel);

      steps.push({
        filePath: file.filePath,
        fileName: this.getFileName(file.filePath),
        complexity: file.complexity as ComplexityLevel,
        estimatedMinutes,
        reasoning,
        dependencies: dependencies.slice(0, 3), // Top 3 dependencies
        order: i,
      });
    }

    return steps;
  }

  /**
   * Generate reasoning for learning a specific file
   */
  private generateReasoning(
    filePath: string,
    category: string,
    moduleName: string,
    depCount: number,
  ): string {
    const fileName = this.getFileName(filePath);

    let reason = `Learn ${fileName} to understand the ${category}`;

    if (depCount > 0) {
      reason += `. This file is used by ${depCount} other files`;
    }

    reason += ` in the ${moduleName} journey.`;

    return reason;
  }

  /**
   * Estimate learning time based on complexity
   */
  private estimateTime(complexity: ComplexityLevel): number {
    switch (complexity) {
      case "BEGINNER":
        return 15;
      case "INTERMEDIATE":
        return 30;
      case "ADVANCED":
        return 45;
      case "EXPERT":
        return 60;
      default:
        return 20;
    }
  }

  /**
   * Order steps intelligently based on dependencies
   */
  private orderSteps(steps: GeneratedStep[]): GeneratedStep[] {
    // Sort by complexity first (easier first), then by dependency count
    return steps.sort((a, b) => {
      const complexityOrder: Record<ComplexityLevel, number> = {
        BEGINNER: 0,
        INTERMEDIATE: 1,
        ADVANCED: 2,
        EXPERT: 3,
      };

      const complexA = complexityOrder[a.complexity];
      const complexB = complexityOrder[b.complexity];

      if (complexA !== complexB) {
        return complexA - complexB;
      }

      // If same complexity, prioritize files with fewer dependencies
      return a.dependencies.length - b.dependencies.length;
    });
  }

  /**
   * Get file name from path
   */
  private getFileName(filePath: string): string {
    return filePath.split("/").pop() || filePath;
  }

  /**
   * Save journey to database
   */
  async saveJourney(
    userId: number,
    repositoryId: number,
    journey: GeneratedJourney,
  ) {
    // Create or update the journey record
    const dbJourney = await prisma.contributorJourney.upsert({
      where: {
        userId_repositoryId_moduleName: {
          userId,
          repositoryId,
          moduleName: journey.moduleName,
        },
      },
      update: {
        goalDescription: journey.moduleName,
        estimatedDays: journey.estimatedDays,
        progress: 0,
        status: "NOT_STARTED" as JourneyStatus,
      },
      create: {
        userId,
        repositoryId,
        moduleName: journey.moduleName,
        goalDescription: journey.moduleName,
        estimatedDays: journey.estimatedDays,
        status: "NOT_STARTED" as JourneyStatus,
        progress: 0,
      },
    });

    // Save journey steps
    for (const step of journey.steps) {
      await prisma.journeyStep.upsert({
        where: {
          journeyId_filePath: {
            journeyId: dbJourney.id,
            filePath: step.filePath,
          },
        },
        update: {
          description: step.reasoning,
          estimatedMinutes: step.estimatedMinutes,
          order: step.order,
        },
        create: {
          journeyId: dbJourney.id,
          filePath: step.filePath,
          fileName: step.fileName,
          complexity: step.complexity,
          estimatedMinutes: step.estimatedMinutes,
          description: step.reasoning,
          reasoning: step.reasoning,
          order: step.order,
          dependencies: step.dependencies,
        },
      });
    }

    return dbJourney;
  }

  /**
   * Get saved journey for a user
   */
  async getJourney(userId: number, journeyId: number) {
    const journey = await prisma.contributorJourney.findFirst({
      where: {
        id: journeyId,
        userId,
      },
      include: {
        steps: {
          orderBy: { order: "asc" },
        },
      },
    });

    return journey;
  }

  /**
   * Get all journeys for a user
   */
  async getUserJourneys(userId: number) {
    return prisma.contributorJourney.findMany({
      where: { userId },
      include: {
        steps: {
          orderBy: { order: "asc" },
        },
        repository: {
          select: {
            id: true,
            name: true,
            url: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Update journey progress
   */
  async updateJourneyProgress(
    journeyId: number,
    userId: number,
    progress: number,
  ) {
    return prisma.contributorJourney.update({
      where: {
        id: journeyId,
      },
      data: {
        progress: Math.min(Math.max(progress, 0), 100),
        status:
          progress === 100
            ? "COMPLETED"
            : progress > 0
              ? "IN_PROGRESS"
              : "NOT_STARTED",
        ...(progress === 100 ? { completedAt: new Date() } : {}),
      },
    });
  }

  /**
   * Mark step as completed
   */
  async markStepComplete(
    journeyId: number,
    stepId: number,
    userId: number,
  ) {
    // Verify user owns this journey
    const journey = await prisma.contributorJourney.findFirst({
      where: { id: journeyId, userId },
    });

    if (!journey) {
      throw new Error("Journey not found");
    }

    // Mark step as complete
    await prisma.journeyStep.update({
      where: { id: stepId },
      data: {
        completed: true,
        completedAt: new Date(),
      },
    });

    // Calculate progress
    const steps = await prisma.journeyStep.findMany({
      where: { journeyId },
    });

    const completedSteps = steps.filter((s) => s.completed).length;
    const progressPercent = Math.round((completedSteps / steps.length) * 100);

    // Update journey progress
    await this.updateJourneyProgress(journeyId, userId, progressPercent);

    return { stepId, progress: progressPercent };
  }
}
