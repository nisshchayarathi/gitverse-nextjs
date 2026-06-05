import { PrismaClient, DataResidencyRegion } from "@prisma/client";
import { REGION_CONFIGS } from "@/types/data-residency";

export class RegionDatabaseService {
  private clients: Map<DataResidencyRegion, PrismaClient> = new Map();

  /**
   * Get the correct database client instance for the specified region.
   * Instantiates connections lazily.
   */
  public getClient(region: DataResidencyRegion): PrismaClient {
    if (this.clients.has(region)) {
      return this.clients.get(region)!;
    }

    const config = REGION_CONFIGS[region];
    const databaseUrl = process.env[config.databaseUrlEnvKey];

    // If a region-specific URL is not provided in env, 
    // it falls back to the default DATABASE_URL for development safety
    const connectionUrl = databaseUrl || process.env.DATABASE_URL;

    const newClient = new PrismaClient({
      datasources: {
        db: {
          url: connectionUrl,
        },
      },
    } as any);

    this.clients.set(region, newClient);
    return newClient;
  }

  /**
   * Close all active region database connections
   */
  public async disconnectAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.$disconnect();
    }
    this.clients.clear();
  }
}

let regionDatabaseSingleton: RegionDatabaseService | null = null;

export function getRegionDatabaseService(): RegionDatabaseService {
  if (!regionDatabaseSingleton) {
    regionDatabaseSingleton = new RegionDatabaseService();
  }
  return regionDatabaseSingleton;
}
