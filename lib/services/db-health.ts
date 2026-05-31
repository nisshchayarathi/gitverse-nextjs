import prisma from "../prisma";
import { DbHealthMetrics } from "../../types/database-health";

export class DatabaseHealthService {
  /**
   * Evaluates the approximate health of the database workload
   * based on the active webhook processing count.
   */
  async checkHealth(): Promise<DbHealthMetrics> {
    try {
      // In a serverless environment, tracking active PostgreSQL connections directly
      // is difficult without PgBouncer. We approximate load by checking how many
      // webhooks are actively "processing".
      const processingCount = await prisma.webhookEvent.count({
        where: { status: "processing" }
      });

      const pendingCount = await prisma.webhookEvent.count({
        where: { status: "pending" }
      });

      let status: DbHealthMetrics["status"] = "Healthy";
      if (processingCount > 8) {
        status = "Critical";
      } else if (processingCount > 5) {
        status = "Degraded";
      }

      return {
        activeConnections: processingCount, // Proxy metric
        poolUtilization: Math.min((processingCount / 10) * 100, 100),
        waitingRequests: pendingCount,
        status,
      };
    } catch (error) {
      console.error("[DatabaseHealthService] Failed to check DB health:", error);
      return {
        activeConnections: 0,
        poolUtilization: 0,
        waitingRequests: 0,
        status: "Critical",
      };
    }
  }

  async isHealthy(): Promise<boolean> {
    const metrics = await this.checkHealth();
    return metrics.status !== "Critical";
  }
}

export const dbHealthService = new DatabaseHealthService();
