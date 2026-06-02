export interface DbHealthMetrics {
  activeConnections: number;
  poolUtilization: number;
  waitingRequests: number;
  status: "Healthy" | "Degraded" | "Critical";
}

export interface WebhookQueueStatus {
  activeWorkers: number;
  pendingJobs: number;
  isThrottled: boolean;
}
