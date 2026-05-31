import { ShardId } from "@/types/sharding";
import { ShardRegistry } from "./shard-registry";
import crypto from "crypto";

export class ShardRouter {
  private registry = ShardRegistry.getInstance();
  // Override map for migrations: maps organizationId to the new target ShardId during/after migration
  private migrationOverrides: Map<string, ShardId> = new Map();

  /**
   * Deterministically assigns an organization to a specific shard.
   * Uses SHA-256 hash modulo the number of active shards.
   */
  public getTargetShard(organizationId: string): ShardId {
    // 1. Check if there's a hard override due to a migration
    if (this.migrationOverrides.has(organizationId)) {
      return this.migrationOverrides.get(organizationId)!;
    }

    // 2. Default deterministic routing
    const activeShards = this.registry.getActiveShards();
    if (activeShards.length === 0) {
      throw new Error("No active shards available for routing.");
    }

    // Sort to ensure stable order across instances
    const sortedShards = activeShards.sort((a, b) => a.id.localeCompare(b.id));

    // Create numeric hash from org ID
    const hash = crypto.createHash("sha256").update(organizationId).digest("hex");
    // Parse first 8 bytes as an integer to use for modulo arithmetic
    const numericHash = BigInt("0x" + hash.slice(0, 16));
    
    const shardIndex = Number(numericHash % BigInt(sortedShards.length));
    
    return sortedShards[shardIndex].id;
  }

  /**
   * Updates the routing override for an organization. Used by the migration worker
   * at the exact moment of cutover.
   */
  public setMigrationOverride(organizationId: string, newShardId: ShardId): void {
    this.migrationOverrides.set(organizationId, newShardId);
  }

  /**
   * Removes a routing override.
   */
  public removeMigrationOverride(organizationId: string): void {
    this.migrationOverrides.delete(organizationId);
  }
}

export const shardRouter = new ShardRouter();
