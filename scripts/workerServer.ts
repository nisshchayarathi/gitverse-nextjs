import "dotenv/config";
import os from "os";
import http from "http";

import { startAnalysisWorkerLoop } from "./analysisWorker";
import { startWebhookWorkerLoop } from "../lib/workers/webhookWorker";
import { disconnectPrisma, getPoolHealth, getPoolMetrics } from "../lib/prisma";

const port = Number(process.env.PORT || "8080");
const GRACE_PERIOD_MS = 35_000;

let healthServer: http.Server | null = null;
let stopping = false;
let workerDone: (() => void) | null = null;
let workerFinished: Promise<void> | null = null;

function startHealthServer(): http.Server {
  const server = http.createServer((req, res) => {
    if (stopping) {
      res.statusCode = 503;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.setHeader("retry-after", "60");
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

    if (req.url === "/drain") {
      const drainMsg = stopping
        ? "already draining"
        : "drain initiated";
      res.statusCode = 200;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end(drainMsg);
      if (!stopping) {
        drain("DRAIN_ENDPOINT");
      }
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

const drain = async (source: string) => {
  if (stopping) return;
  stopping = true;
  console.log(`drain initiated via ${source}`);

  if (workerDone) {
    workerDone();
  }

  const forcedExit = setTimeout(() => {
    if (healthServer) {
      healthServer.close(() => {});
    }
    console.error(`drain timeout after ${GRACE_PERIOD_MS}ms, forcing exit`);
    disconnectPrisma().catch(() => {});
    process.exit(1);
  }, GRACE_PERIOD_MS);

  if (workerFinished) {
    await workerFinished;
  }

  clearTimeout(forcedExit);

  if (healthServer) {
    await new Promise<void>((resolve) => healthServer!.close(() => resolve()));
  }

  await disconnectPrisma();
  process.exit(0);
};

const shutdown = async (signal: string) => {
  await drain(signal);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGQUIT", () => void shutdown("SIGQUIT"));
process.on("SIGHUP", () => void shutdown("SIGHUP"));

async function main() {
  healthServer = startHealthServer();

  workerFinished = new Promise<void>((resolve) => {
    workerDone = resolve;
  });

  await startAnalysisWorkerLoop();
  await startWebhookWorkerLoop({ workerId: `${os.hostname()}-webhook` });

  if (!stopping) {
    workerDone?.();
  }
}

main().catch(async (e) => {
  console.error("worker-server fatal:", e);
  await disconnectPrisma();
  process.exit(1);
});
