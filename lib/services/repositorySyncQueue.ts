import prisma from "../../lib/prisma";

export class RepositorySyncQueue {
  /**
   * Queues a sync job, returning false if a duplicate is already pending.
   */
  public static async enqueueSyncJob(repositoryId: number, eventType: string): Promise<boolean> {
    try {
      // Deduplication: Check if there's already a QUEUED job for this event type and repo
      const existingJob = await prisma.repositorySyncJob.findFirst({
        where: {
          repositoryId,
          eventType,
          status: "QUEUED"
        }
      });

      if (existingJob) {
        return false; // Already queued
      }

      await prisma.repositorySyncJob.create({
        data: {
          repositoryId,
          eventType,
          status: "QUEUED"
        }
      });

      return true;
    } catch (e) {
      console.error("Failed to enqueue repository sync job:", e);
      return false;
    }
  }

  public static async markProcessing(jobId: string): Promise<void> {
    await prisma.repositorySyncJob.update({
      where: { id: jobId },
      data: { status: "PROCESSING", startedAt: new Date() }
    });
  }

  public static async markCompleted(jobId: string): Promise<void> {
    await prisma.repositorySyncJob.update({
      where: { id: jobId },
      data: { status: "COMPLETED", completedAt: new Date() }
    });
  }

  public static async markFailed(jobId: string, error: string): Promise<void> {
    await prisma.repositorySyncJob.update({
      where: { id: jobId },
      data: { status: "FAILED", completedAt: new Date(), errorMessage: error }
    });
  }
}
