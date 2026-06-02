import { PrismaClient } from "@prisma/client";
import { ShardId } from "@/types/sharding";
import { ShardRegistry } from "./shard-registry";
import { shardRouter } from "./shard-router";

export class PrismaShardRouter {
  private static instance: PrismaShardRouter;
  private clients: Map<ShardId, PrismaClient> = new Map();
  private registry = ShardRegistry.getInstance();

  private constructor() {}

  public static getInstance(): PrismaShardRouter {
    if (!PrismaShardRouter.instance) {
      PrismaShardRouter.instance = new PrismaShardRouter();
    }
    return PrismaShardRouter.instance;
  }

  /**
   * Retrieves or initializes a Prisma client connected to the correct shard
   * for the given organization.
   */
  public getShardClient(organizationId: string): PrismaClient {
    const targetShardId = shardRouter.getTargetShard(organizationId);
    return this.getClientForShard(targetShardId);
  }

  /**
   * Retrieves or initializes a Prisma client directly by Shard ID.
   * Useful for administrative queries or cross-shard migrations.
   */
  public getClientForShard(shardId: ShardId): PrismaClient {
    if (this.clients.has(shardId)) {
      return this.clients.get(shardId)!;
    }

    const shardInfo = this.registry.getShard(shardId);
    if (!shardInfo) {
      throw new Error(`Shard ${shardId} not found in registry.`);
    }

    if (!shardInfo.isAvailable) {
      throw new Error(`Shard ${shardId} is currently unavailable.`);
    }

    // Initialize new client
    const newClient = new PrismaClient({
      datasources: {
        db: {
          url: shardInfo.url,
        },
      },
    } as any);

    this.clients.set(shardId, newClient);
    return newClient;
  }

  /**
   * Cleans up all connections gracefully.
   */
  public async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.values()).map(client =>
      client.$disconnect()
    );
    await Promise.all(disconnectPromises);
    this.clients.clear();
  }
}

export const prismaShardRouter = PrismaShardRouter.getInstance();
