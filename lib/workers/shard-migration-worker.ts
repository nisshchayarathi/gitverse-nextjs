import { MigrationJob, MigrationState, ShardId } from "@/types/sharding";
import { prismaShardRouter } from "../services/sharding/prisma-router";
import { shardRouter } from "../services/sharding/shard-router";
import { ShardValidator } from "../services/sharding/shard-validator";

export class ShardMigrationWorker {
  private activeJobs: Map<string, MigrationJob> = new Map();
  private validator = new ShardValidator();

  /**
   * Initializes a zero-downtime migration of an organization's embeddings
   * from one shard to another.
   */
  public async startMigration(
    organizationId: string,
    sourceShardId: ShardId,
    targetShardId: ShardId
  ): Promise<string> {
    const jobId = `mig_${Date.now()}_${organizationId}`;
    
    const job: MigrationJob = {
      id: jobId,
      organizationId,
      sourceShardId,
      targetShardId,
      state: "PENDING",
      progressPercent: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.activeJobs.set(jobId, job);
    
    // Kick off the state machine asynchronously
    this.processMigration(jobId).catch(err => {
      console.error(`Migration ${jobId} failed completely:`, err);
    });

    return jobId;
  }

  public getJobStatus(jobId: string): MigrationJob | undefined {
    return this.activeJobs.get(jobId);
  }

  private updateJobState(jobId: string, state: MigrationState, percent: number, error?: string) {
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.state = state;
      job.progressPercent = percent;
      job.updatedAt = new Date().toISOString();
      if (error) job.error = error;
      this.activeJobs.set(jobId, job);
      console.log(`[MigrationWorker] Job ${jobId} transitioned to ${state} (${percent}%)`);
    }
  }

  private async processMigration(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    try {
      const sourceClient = prismaShardRouter.getClientForShard(job.sourceShardId);
      const targetClient = prismaShardRouter.getClientForShard(job.targetShardId);

      // Phase 1: Read & Copy
      this.updateJobState(jobId, "READING_SOURCE", 10);
      
      // MOCK: In the actual implementation, this would iterate over pgvector tables
      // using keyset pagination and insert into targetClient
      await new Promise(resolve => setTimeout(resolve, 500)); 
      
      this.updateJobState(jobId, "COPYING_DATA", 50);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Phase 2: Verification
      this.updateJobState(jobId, "VERIFYING_DATA", 80);
      const validation = await this.validator.validateMigration(
        job.organizationId,
        sourceClient,
        targetClient,
        job.sourceShardId,
        job.targetShardId
      );

      if (!validation.isValid) {
        throw new Error(`Verification failed: ${validation.reasons.join(", ")}`);
      }

      // Phase 3: Switch Routing (Zero Downtime Cutover)
      this.updateJobState(jobId, "SWITCHING_ROUTING", 90);
      shardRouter.setMigrationOverride(job.organizationId, job.targetShardId);

      // Phase 4: Cleanup Source Data
      this.updateJobState(jobId, "CLEANUP", 95);
      // MOCK: await sourceClient.embedding.deleteMany({ where: { organizationId } })

      this.updateJobState(jobId, "COMPLETED", 100);

    } catch (error: any) {
      this.updateJobState(jobId, "FAILED", job.progressPercent, error.message);
      this.rollbackMigration(jobId);
    }
  }

  private rollbackMigration(jobId: string) {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    console.warn(`[MigrationWorker] Rolling back migration ${jobId}`);
    
    // Remove routing override so traffic stays on source
    shardRouter.removeMigrationOverride(job.organizationId);
    
    // MOCK: Clean up partial data on target shard
    // targetClient.embedding.deleteMany({ where: { organizationId } })
    
    this.updateJobState(jobId, "ROLLED_BACK", 0, "Rolled back due to failure");
  }
}
