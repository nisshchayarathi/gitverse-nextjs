import { DataResidencyRegion } from "@prisma/client";

export type { DataResidencyRegion };

export interface RegionConfiguration {
  defaultRegion: DataResidencyRegion;
  allowedRegions: DataResidencyRegion[];
  fallbackAllowed: boolean;
}

export interface CompliancePolicy {
  complianceMode: "STANDARD" | "STRICT" | "GDPR_READY";
  enforceStorageIsolation: boolean;
  enforceRetrievalIsolation: boolean;
  enforceAiProcessingIsolation: boolean;
}

export interface RegionalStorageConfig {
  databaseUrlEnvKey: string;
  redisUrlEnvKey?: string;
  storageBucketName?: string;
}

export interface ComplianceViolation {
  organizationId: string;
  repositoryId?: number;
  userId?: number;
  attemptedRegion: DataResidencyRegion | string;
  allowedRegions: DataResidencyRegion[];
  resource: string;
  action: string;
  reason: string;
  timestamp: string;
}

export const REGION_CONFIGS: Record<DataResidencyRegion, RegionalStorageConfig> = {
  US: {
    databaseUrlEnvKey: "DATABASE_URL_US",
    redisUrlEnvKey: "REDIS_URL_US",
    storageBucketName: "gitverse-storage-us",
  },
  EU: {
    databaseUrlEnvKey: "DATABASE_URL_EU",
    redisUrlEnvKey: "REDIS_URL_EU",
    storageBucketName: "gitverse-storage-eu",
  },
  APAC: {
    databaseUrlEnvKey: "DATABASE_URL_APAC",
    redisUrlEnvKey: "REDIS_URL_APAC",
    storageBucketName: "gitverse-storage-apac",
  },
};
