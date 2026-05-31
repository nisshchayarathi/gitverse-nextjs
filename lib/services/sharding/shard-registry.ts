import { ShardId, ShardInfo } from "@/types/sharding";

export class ShardRegistry {
  private static instance: ShardRegistry;
  private shards: Map<ShardId, ShardInfo> = new Map();

  private constructor() {
    this.initializeShards();
  }

  public static getInstance(): ShardRegistry {
    if (!ShardRegistry.instance) {
      ShardRegistry.instance = new ShardRegistry();
    }
    return ShardRegistry.instance;
  }

  private initializeShards() {
    // In a real environment, these would be loaded from environment variables 
    // or a configuration database to allow dynamic expansion.
    // Example: process.env.SHARD_URLS = "shard1=url1,shard2=url2"
    
    const mockShards: ShardInfo[] = [
      { id: "shard-1", url: process.env.DATABASE_URL_SHARD_1 || process.env.DATABASE_URL || "", isAvailable: true, status: "ACTIVE", weight: 100 },
      { id: "shard-2", url: process.env.DATABASE_URL_SHARD_2 || process.env.DATABASE_URL || "", isAvailable: true, status: "ACTIVE", weight: 100 },
      { id: "shard-3", url: process.env.DATABASE_URL_SHARD_3 || process.env.DATABASE_URL || "", isAvailable: true, status: "ACTIVE", weight: 100 },
    ];

    mockShards.forEach(shard => this.shards.set(shard.id, shard));
  }

  public getActiveShards(): ShardInfo[] {
    return Array.from(this.shards.values()).filter(s => s.status === "ACTIVE" && s.isAvailable);
  }

  public getAllShards(): ShardInfo[] {
    return Array.from(this.shards.values());
  }

  public getShard(id: ShardId): ShardInfo | undefined {
    return this.shards.get(id);
  }

  public updateShardStatus(id: ShardId, isAvailable: boolean, status?: ShardInfo["status"]) {
    const shard = this.shards.get(id);
    if (shard) {
      shard.isAvailable = isAvailable;
      if (status) shard.status = status;
      this.shards.set(id, shard);
    }
  }
}
