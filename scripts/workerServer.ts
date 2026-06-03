import "dotenv/config";
import http from "http";

import { startAnalysisWorkerLoop } from "./analysisWorker";
import { disconnectPrisma, getPoolHealth, getPoolMetrics } from "../lib/prisma";

const port = Number(process.env.PORT || "8080");
let healthServer: http.Server | null = null;
let stopping = false;

function startHealthServer(): http.Server {
  const server = http.createServer((req, res) => {
    if (stopping) {
      res.statusCode = 503;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end("shutting down");
      return;
    }
    if (req.url === "/" || req.url === "/healthz" || req.url === "/readyz") {
      res.statusCode = 200;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end("ok");
      return;
    }

    if (req.url === "/metrics") {
      const health = getPoolHealth();
      const metrics = getPoolMetrics();
      const lines: string[] = [
        `# HELP prisma_pool_healthy Whether the connection pool is healthy (1=healthy, 0=unhealthy)`,
        `# TYPE prisma_pool_healthy gauge`,
        `prisma_pool_healthy ${health.healthy ? 1 : 0}`,
        `# HELP prisma_pool_total_connections Total connections across all pools`,
        `# TYPE prisma_pool_total_connections gauge`,
        `prisma_pool_total_connections ${health.totalConnections}`,
        `# HELP prisma_pool_idle_connections Idle connections across all pools`,
        `# TYPE prisma_pool_idle_connections gauge`,
        `prisma_pool_idle_connections ${health.idleConnections}`,
        `# HELP prisma_pool_waiting_clients Waiting clients across all pools`,
        `# TYPE prisma_pool_waiting_clients gauge`,
        `prisma_pool_waiting_clients ${health.waitingClients}`,
      ];
      for (const m of metrics) {
        lines.push(`# HELP prisma_pool_connections_total{adapter="${m.adapter}"} Total connections per adapter`);
        lines.push(`# TYPE prisma_pool_connections_total gauge`);
        lines.push(`prisma_pool_connections_total{adapter="${m.adapter}"} ${m.totalConnections}`);
        lines.push(`prisma_pool_idle_connections_total{adapter="${m.adapter}"} ${m.idleConnections}`);
        lines.push(`prisma_pool_waiting_clients_total{adapter="${m.adapter}"} ${m.waitingClients}`);
      }
      res.statusCode = 200;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end(lines.join("\n") + "\n");
      return;
    }

    res.statusCode = 404;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("not found");
  });

  server.listen(port, () => {
    console.log(`worker health server listening on :${port}`);
  });

  return server;
}

const shutdown = async (signal: string) => {
  if (stopping) return;
  stopping = true;
  console.log(`received ${signal}, shutting down worker server...`);

  if (healthServer) {
    await new Promise<void>((resolve) => healthServer!.close(() => resolve()));
  }

  await disconnectPrisma();
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGQUIT", () => void shutdown("SIGQUIT"));
process.on("SIGHUP", () => void shutdown("SIGHUP"));

async function main() {
  healthServer = startHealthServer();

  // Run worker loop indefinitely.
  await startAnalysisWorkerLoop();
}

main().catch(async (e) => {
  console.error("worker-server fatal:", e);
  await disconnectPrisma();
  process.exit(1);
});
