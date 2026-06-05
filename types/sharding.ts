export type ShardId = string;

export interface ShardInfo {
  id: ShardId;
  url: string;
  isAvailable: boolean;
  status: "ACTIVE" | "MAINTENANCE" | "OFFLINE";
  weight: number;
}

export type MigrationState = 
  | "PENDING"
  | "READING_SOURCE"
  | "COPYING_DATA"
  | "VERIFYING_DATA"
  | "SWITCHING_ROUTING"
  | "CLEANUP"
  | "COMPLETED"
  | "FAILED"
  | "ROLLED_BACK";

export interface MigrationJob {
  id: string;
  organizationId: string;
  sourceShardId: ShardId;
  targetShardId: ShardId;
  state: MigrationState;
  progressPercent: number;
  startedAt: string;
  updatedAt: string;
  error?: string;
}

export interface ShardHealthStatus {
  shardId: ShardId;
  isAvailable: boolean;
  latencyMs: number;
  lastChecked: string;
}
