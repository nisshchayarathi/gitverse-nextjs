"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectPrisma = disconnectPrisma;
exports.getPoolHealth = getPoolHealth;
exports.getPoolMetrics = getPoolMetrics;
exports.prisma = void 0;
exports.getPrisma = getPrisma;
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const adapter_neon_1 = require("@prisma/adapter-neon");
const serverless_1 = require("@neondatabase/serverless");
const ws_1 = __importDefault(require("ws"));
serverless_1.neonConfig.webSocketConstructor = ws_1.default;
function getAdapterChoice(connectionString) {
    const envChoice = (process.env.PRISMA_ADAPTER || "").trim().toLowerCase();
    if (envChoice === "pg")
        return "pg";
    if (envChoice === "neon-http")
        return "neon-http";
    if (envChoice === "neon" || envChoice === "neon-ws")
        return "neon-ws";
    let host = "";
    try {
        host = new URL(connectionString).host;
    }
    catch {
    }
    const isNeonHost = host.endsWith(".neon.tech") || connectionString.includes("neon.tech");
    if (isNeonHost)
        return "neon-ws";
    return "pg";
}
function withRetry(client) {
    return client.$extends({
        query: {
            $allModels: {
                async $allOperations({ operation, model, args, query }) {
                    let retries = 0;
                    const maxRetries = 3;
                    while (true) {
                        try {
                            return await query(args);
                        }
                        catch (error) {
                            const isColdStartError = error?.code === 'P1001' ||
                                error?.code === 'P2024' ||
                                error?.message?.toLowerCase().includes('timeout') ||
                                error?.message?.toLowerCase().includes('connection pool') ||
                                error?.message?.toLowerCase().includes('connect') ||
                                error?.message?.toLowerCase().includes('fetch failed');
                            if (!isColdStartError || retries >= maxRetries) {
                                throw error;
                            }
                            retries++;
                            const backoff = Math.pow(2, retries) * 500;
                            console.warn(`[Prisma Retry] DB connection error (attempt ${retries}/${maxRetries}). Retrying in ${backoff}ms...`);
                            await new Promise((r) => setTimeout(r, backoff));
                        }
                    }
                },
            },
        },
    });
}
const pools = [];
function registerPool(pool, adapter) {
    pools.push({ pool, adapter });
}
function getPoolMetrics() {
    return pools.map(({ pool, adapter }) => ({
        adapter,
        totalConnections: pool.totalCount ?? 0,
        idleConnections: pool.idleCount ?? 0,
        waitingClients: pool.waitingCount ?? 0,
    }));
}
function getPoolHealth() {
    const metrics = getPoolMetrics();
    const totalConnections = metrics.reduce((s, m) => s + m.totalConnections, 0);
    const idleConnections = metrics.reduce((s, m) => s + m.idleConnections, 0);
    const waitingClients = metrics.reduce((s, m) => s + m.waitingClients, 0);
    return {
        healthy: waitingClients === 0 || idleConnections > 0,
        activePools: metrics.length,
        totalConnections,
        idleConnections,
        waitingClients,
        metrics,
    };
}
function createPrismaClient() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL is required");
    }
    const adapterChoice = getAdapterChoice(connectionString);
    const poolMaxRaw = process.env.PG_POOL_MAX;
    const defaultPoolMax = process.env.NODE_ENV === "production" ? 10 : 5;
    const poolMax = poolMaxRaw ? Number(poolMaxRaw) : defaultPoolMax;
    const normalizedPoolMax = Number.isFinite(poolMax) && poolMax > 0 ? poolMax : defaultPoolMax;
    const connectionTimeoutMsRaw = process.env.PG_POOL_CONNECTION_TIMEOUT_MS;
    const connectionTimeoutMs = connectionTimeoutMsRaw
        ? Number(connectionTimeoutMsRaw)
        : 30000;
    const normalizedConnectionTimeoutMs = Number.isFinite(connectionTimeoutMs) && connectionTimeoutMs > 0
        ? connectionTimeoutMs
        : 30000;
    if (adapterChoice === "neon-ws") {
        const pool = new serverless_1.Pool({
            connectionString,
            connectionTimeoutMillis: normalizedConnectionTimeoutMs,
            idleTimeoutMillis: process.env.NODE_ENV === "production" ? 30000 : 10000,
            max: normalizedPoolMax,
        });
        pool.on("error", (err) => {
            console.error("Unexpected Neon WebSocket pool error:", err);
        });
        registerPool(pool, "neon-ws");
        const adapter = new adapter_neon_1.PrismaNeon(pool);
        return withRetry(new client_1.PrismaClient({
            adapter,
            log: ["error", "warn"],
        }));
    }
    if (adapterChoice === "neon-http") {
        const adapter = new adapter_neon_1.PrismaNeonHttp(connectionString, {});
        return withRetry(new client_1.PrismaClient({ adapter, log: ["error", "warn"] }));
    }
    const pool = new pg_1.Pool({
        connectionString,
        connectionTimeoutMillis: normalizedConnectionTimeoutMs,
        idleTimeoutMillis: process.env.NODE_ENV === "production" ? 30000 : 10000,
        max: normalizedPoolMax,
        min: 0,
    });
    pool.on("error", (err) => {
        console.error("Unexpected pg TCP pool error:", err);
    });
    registerPool(pool, "pg");
    const adapter = new adapter_pg_1.PrismaPg(pool);
    return withRetry(new client_1.PrismaClient({
        adapter,
        log: ["error", "warn"],
    }));
}
const globalForPrisma = globalThis;
function getPrisma() {
    if (!globalForPrisma.prisma) {
        globalForPrisma.prisma = createPrismaClient();
    }
    return globalForPrisma.prisma;
}
const DISCONNECT_TIMEOUT_MS = 10_000;
let disconnectInProgress = false;
async function disconnectPrisma(options) {
    if (disconnectInProgress)
        return;
    disconnectInProgress = true;
    const client = globalForPrisma.prisma;
    if (client) {
        globalForPrisma.prisma = undefined;
        try {
            const timeoutMs = options?.timeoutMs ?? DISCONNECT_TIMEOUT_MS;
            const disconnect = client.$disconnect();
            const timer = timeoutMs > 0
                ? new Promise((_, reject) => setTimeout(() => reject(new Error("disconnect timed out")), timeoutMs))
                : null;
            await (timer ? Promise.race([disconnect, timer]) : disconnect);
        }
        catch (err) {
            const isTimeout = err?.message === "disconnect timed out";
            console.warn(isTimeout
                ? "[Prisma] disconnect timed out \u2014 forcing cleanup"
                : `[Prisma] disconnect error: ${err?.message ?? err}`);
        }
    }
    disconnectInProgress = false;
}
const prisma = new Proxy({}, {
    get(_target, prop) {
        const client = getPrisma();
        return client[prop];
    },
});
exports.prisma = prisma;
exports.default = prisma;
process.once("beforeExit", async () => {
    if (globalForPrisma.prisma) {
        await disconnectPrisma();
    }
});
