import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface SnapshotData {
  repository: {
    id: number;
    name: string;
    url: string;
    description?: string;
    stars: number;
    forks: number;
    watchers: number;
    defaultBranch: string;
    size: number;
    createdAt: string;
    updatedAt: string;
  };
  languages: Array<{
    name: string;
    percentage: number;
    bytes: number;
    lines: number;
    color?: string;
  }>;
  files: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  commits: any[];
  contributors: Array<{
    name: string;
    email: string;
    commits: number;
    percentage: number;
    avatar?: string;
  }>;
  // Analysis data
  geminiInsights?: any;
  dependencyRisks?: any;
  codeComplexity?: any;
  deadCodeAnalysis?: any;
  architectureMap?: any;
  // Metadata
  snapshotCreatedAt: string;
  analysisCompletedAt: string;
}

export class PublicSnapshotService {
  /**
   * Create a new public snapshot from current repository analysis
   * Freezes all analysis data at this point in time
   */
  static async createSnapshot(
    repositoryId: number,
    createdByUserId: number,
    ttlHours: number = 24 * 30 // 30 days default
  ): Promise<{ snapshotId: string; url: string }> {
    try {
      // Fetch current repository data
      const repo = await prisma.repository.findUnique({
        where: { id: repositoryId },
        include: {
          languages: true,
          files: true,
          commits: {
            orderBy: { committedAt: "desc" },
            take: 100,
          },
          contributors: {
            orderBy: { commits: "desc" },
            take: 50,
          },
          geminiAnalysisCache: {
            orderBy: { lastAccessedAt: "desc" },
            take: 10,
          },
        },
      });

      if (!repo) {
        throw new Error("Repository not found");
      }

      // Build snapshot data
      const snapshotData: SnapshotData = {
        repository: {
          id: repo.id,
          name: repo.name,
          url: repo.url,
          description: repo.description || undefined,
          stars: repo.stars,
          forks: repo.forks,
          watchers: 0, // Not stored in current schema
          defaultBranch: repo.defaultBranch,
          size: repo.size,
          createdAt: repo.createdAt.toISOString(),
          updatedAt: repo.updatedAt.toISOString(),
        },
        languages: repo.languages.map((lang) => ({
          name: lang.name,
          percentage: lang.percentage,
          bytes: lang.bytes,
          lines: lang.lines,
          color: lang.color || undefined,
        })),
        files: [], // Will be populated from analysis jobs
        commits: repo.commits.map((commit) => ({
          hash: commit.hash,
          message: commit.message,
          author: commit.authorName,
          date: commit.committedAt.toISOString(),
          additions: commit.additions,
          deletions: commit.deletions,
        })),
        contributors: repo.contributors.map((contrib) => ({
          name: contrib.name,
          email: contrib.email,
          commits: contrib.commits,
          percentage: contrib.percentage,
          avatar: contrib.avatar || undefined,
        })),
        geminiInsights: repo.geminiAnalysisCache[0]?.cachedResult || null,
        snapshotCreatedAt: new Date().toISOString(),
        analysisCompletedAt: repo.lastAnalyzedAt?.toISOString() || new Date().toISOString(),
      };

      // Create snapshot in database
      const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
      const snapshot = await prisma.publicSnapshot.create({
        data: {
          repositoryId,
          createdByUserId,
          snapshotData: snapshotData as any,
          expiresAt,
        },
      });

      logger.info(
        { repositoryId, snapshotId: snapshot.id, expiresAt },
        "Public snapshot created"
      );

      return {
        snapshotId: snapshot.id,
        url: `/public/repo/${repositoryId}/snapshot/${snapshot.id}`,
      };
    } catch (error) {
      logger.error(
        { repositoryId, createdByUserId, error },
        "Failed to create public snapshot"
      );
      throw error;
    }
  }

  /**
   * Retrieve a snapshot by ID and repository ID
   * Returns null if snapshot is expired
   * Increments viewCount
   */
  static async getSnapshot(
    repositoryId: number,
    snapshotId: string
  ): Promise<(SnapshotData & { expiresAt: Date }) | null> {
    try {
      const snapshot = await prisma.publicSnapshot.findFirst({
        where: {
          id: snapshotId,
          repositoryId,
        },
      });

      if (!snapshot) {
        return null;
      }

      // Check if expired
      if (snapshot.expiresAt <= new Date()) {
        return null;
      }

      // Increment view count (non-blocking)
      prisma.publicSnapshot
        .update({
          where: { id: snapshotId },
          data: { viewCount: { increment: 1 } },
        })
        .catch((err) => {
          logger.warn({ snapshotId, error: err }, "Failed to increment snapshot viewCount");
        });

      return {
        ...(snapshot.snapshotData as SnapshotData),
        expiresAt: snapshot.expiresAt,
      };
    } catch (error) {
      logger.error(
        { repositoryId, snapshotId, error },
        "Failed to retrieve public snapshot"
      );
      throw error;
    }
  }

  /**
   * Get all snapshots for a repository
   */
  static async getSnapshotsForRepository(
    repositoryId: number,
    userId?: number
  ): Promise<
    Array<{
      id: string;
      createdAt: Date;
      expiresAt: Date;
      viewCount: number;
      url: string;
    }>
  > {
    try {
      const snapshots = await prisma.publicSnapshot.findMany({
        where: {
          repositoryId,
          ...(userId && { createdByUserId: userId }),
        },
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          viewCount: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return snapshots.map((s) => ({
        ...s,
        url: `/public/repo/${repositoryId}/snapshot/${s.id}`,
      }));
    } catch (error) {
      logger.error(
        { repositoryId, userId, error },
        "Failed to list snapshots"
      );
      throw error;
    }
  }

  /**
   * Delete a snapshot (only creator or repo owner can do this)
   */
  static async deleteSnapshot(snapshotId: string): Promise<void> {
    try {
      await prisma.publicSnapshot.delete({
        where: { id: snapshotId },
      });

      logger.info({ snapshotId }, "Public snapshot deleted");
    } catch (error) {
      logger.error({ snapshotId, error }, "Failed to delete public snapshot");
      throw error;
    }
  }

  /**
   * Clean up expired snapshots (run periodically)
   */
  static async cleanupExpiredSnapshots(): Promise<number> {
    try {
      const result = await prisma.publicSnapshot.deleteMany({
        where: {
          expiresAt: { lte: new Date() },
        },
      });

      logger.info(
        { deletedCount: result.count },
        "Cleaned up expired snapshots"
      );
      return result.count;
    } catch (error) {
      logger.error({ error }, "Failed to clean up expired snapshots");
      return 0;
    }
  }

  /**
   * Check if user has reached rate limit for snapshot creation
   * Limit: 10 snapshots per hour per user
   */
  static async checkSnapshotRateLimit(userId: number): Promise<boolean> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const count = await prisma.publicSnapshot.count({
        where: {
          createdByUserId: userId,
          createdAt: { gte: oneHourAgo },
        },
      });

      return count >= 10; // Rate limit: 10 per hour
    } catch (error) {
      logger.error({ userId, error }, "Failed to check snapshot rate limit");
      // On error, don't enforce limit
      return false;
    }
  }

  /**
   * Get snapshot creation metrics (for analytics)
   */
  static async getSnapshotMetrics(repositoryId: number): Promise<{
    totalSnapshots: number;
    totalViews: number;
    avgViewsPerSnapshot: number;
    activeSnapshots: number;
  }> {
    try {
      const snapshots = await prisma.publicSnapshot.findMany({
        where: { repositoryId },
        select: {
          viewCount: true,
          expiresAt: true,
        },
      });

      const now = new Date();
      const activeSnapshots = snapshots.filter((s) => s.expiresAt > now).length;
      const totalViews = snapshots.reduce((sum, s) => sum + s.viewCount, 0);

      return {
        totalSnapshots: snapshots.length,
        totalViews,
        avgViewsPerSnapshot:
          snapshots.length > 0 ? totalViews / snapshots.length : 0,
        activeSnapshots,
      };
    } catch (error) {
      logger.error({ repositoryId, error }, "Failed to get snapshot metrics");
      throw error;
    }
  }
}

export const publicSnapshotService = PublicSnapshotService;