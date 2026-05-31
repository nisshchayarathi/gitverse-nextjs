"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.getPrisma = getPrisma;
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const adapter_neon_1 = require("@prisma/adapter-neon");
const serverless_1 = require("@neondatabase/serverless");
const ws_1 = __importDefault(require("ws"));
// Set webSocketConstructor so @neondatabase/serverless works via WebSockets in Node.js/serverless environments
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
        // Ignore URL parsing errors; fall through
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
                            const backoff = Math.pow(2, retries) * 500; // 1s, 2s, 4s
                            console.warn(`[Prisma Retry] DB connection error (attempt ${retries}/${maxRetries}). Retrying in ${backoff}ms...`);
                            await new Promise((r) => setTimeout(r, backoff));
                        }
                    }
                },
            },
        },
    });
}
function createPrismaClient() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL is required");
    }
    const adapterChoice = getAdapterChoice(connectionString);
    // Connection Pool configuration
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
        // 1. WebSocket-based pooled adapter for Neon in serverless environment
        const pool = new serverless_1.Pool({
            connectionString,
            connectionTimeoutMillis: normalizedConnectionTimeoutMs,
            idleTimeoutMillis: process.env.NODE_ENV === "production" ? 30000 : 10000,
            max: normalizedPoolMax,
        });
        pool.on("error", (err) => {
            console.error("Unexpected Neon WebSocket pool error:", err);
        });
        const adapter = new adapter_neon_1.PrismaNeon(pool);
        return withRetry(new client_1.PrismaClient({
            adapter,
            log: ["error", "warn"],
        }));
    }
    if (adapterChoice === "neon-http") {
        // 2. HTTP-based fetch adapter for Neon (no pooling)
        const adapter = new adapter_neon_1.PrismaNeonHttp(connectionString, {});
        return withRetry(new client_1.PrismaClient({ adapter, log: ["error", "warn"] }));
    }
    // 3. Default: pg TCP connection pool adapter
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
const prisma = new Proxy({}, {
    get(_target, prop) {
        const client = getPrisma();
        return client[prop];
    },
});
exports.prisma = prisma;
exports.default = prisma;
