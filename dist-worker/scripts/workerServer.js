"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const http_1 = __importDefault(require("http"));
const analysisWorker_1 = require("./analysisWorker");
const prisma_1 = require("../lib/prisma");
const port = Number(process.env.PORT || "8080");
let healthServer = null;
let stopping = false;
function startHealthServer() {
    const server = http_1.default.createServer((req, res) => {
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
            const health = (0, prisma_1.getPoolHealth)();
            const metrics = (0, prisma_1.getPoolMetrics)();
            const lines = [
                `# HELP prisma_pool_healthy Whether connection pool is healthy`,
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
const shutdown = async (signal) => {
    if (stopping)
        return;
    stopping = true;
    console.log(`received ${signal}, shutting down worker server...`);
    if (healthServer) {
        await new Promise((resolve) => healthServer.close(() => resolve()));
    }
    await (0, prisma_1.disconnectPrisma)();
    process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGQUIT", () => void shutdown("SIGQUIT"));
process.on("SIGHUP", () => void shutdown("SIGHUP"));
async function main() {
    healthServer = startHealthServer();
    await (0, analysisWorker_1.startAnalysisWorkerLoop)();
}
main().catch(async (e) => {
    console.error("worker-server fatal:", e);
    await (0, prisma_1.disconnectPrisma)();
    process.exit(1);
});
