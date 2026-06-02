import { ShardRegistry } from "./shard-registry";
import { prismaShardRouter } from "./prisma-router";
import { ShardHealthStatus } from "@/types/sharding";

export class ShardHealthMonitor {
  private registry = ShardRegistry.getInstance();

  /**
   * Pings all active shards to check their connection health and latency.
   * Updates the global registry with the results.
   */
  public async checkAllShards(): Promise<ShardHealthStatus[]> {
    const shards = this.registry.getAllShards();
    const healthStatuses: ShardHealthStatus[] = [];

    for (const shard of shards) {
      const startTime = Date.now();
      let isAvailable = false;
      let latencyMs = -1;

      try {
        const client = prismaShardRouter.getClientForShard(shard.id);
        // Simple ping query using raw SQL to test connection
        await client.$queryRaw`SELECT 1`;
        
        latencyMs = Date.now() - startTime;
        isAvailable = true;
      } catch (error) {
        console.error(`[ShardHealth] Shard ${shard.id} is unreachable:`, error);
        isAvailable = false;
      }

      const status: ShardHealthStatus = {
        shardId: shard.id,
        isAvailable,
        latencyMs,
        lastChecked: new Date().toISOString()
      };

      healthStatuses.push(status);

      // Automatically update registry with the health status
      this.registry.updateShardStatus(
        shard.id, 
        isAvailable, 
        isAvailable ? "ACTIVE" : "OFFLINE"
      );
    }

    return healthStatuses;
  }
}
