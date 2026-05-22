"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.getPrisma = getPrisma;
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const adapter_neon_1 = require("@prisma/adapter-neon");
function getAdapterChoice(connectionString) {
    const envChoice = (process.env.PRISMA_ADAPTER || "").trim().toLowerCase();
    if (envChoice === "pg")
        return "pg";
    if (envChoice === "neon" || envChoice === "neon-http")
        return "neon-http";
    // Heuristics:
    // - If you're using Neon pooler (`-pooler.` host), prefer TCP via `pg` adapter.
    //   The Neon HTTP driver uses `fetch()` and can be flaky/blocked in some environments.
    // - Otherwise, fall back to Neon HTTP for Neon URLs.
    let host = "";
    try {
        host = new URL(connectionString).host;
    }
    catch {
        // Ignore URL parsing errors; fall through.
    }
    const isNeonHost = host.endsWith(".neon.tech") || connectionString.includes("neon.tech");
    const isPoolerHost = host.includes("-pooler.");
    if (isPoolerHost)
        return "pg";
    if (isNeonHost)
        return "neon-http";
    return "pg";
}
function createPrismaClient() {
    const connectionString = process.env.DATABASE_URL;
    // IMPORTANT: Prisma Client is configured to use the "client" engine (driver adapters).
    // Instantiating PrismaClient without an adapter will throw.
    // We intentionally defer instantiation until runtime so builds don't require secrets.
    if (!connectionString) {
        throw new Error("DATABASE_URL is required");
    }
    const adapterChoice = getAdapterChoice(connectionString);
    if (adapterChoice === "neon-http") {
        // Your environment is rejecting Neon WebSocket connections (expects HTTP 101).
        // Use Neon HTTP mode to avoid WS handshakes entirely.
        const adapter = new adapter_neon_1.PrismaNeonHttp(connectionString, {});
        return new client_1.PrismaClient({ adapter, log: ["error", "warn"] });
    }
    const poolMaxRaw = process.env.PG_POOL_MAX;
    const defaultPoolMax = process.env.NODE_ENV === "production" ? 2 : 1;
    const poolMax = poolMaxRaw ? Number(poolMaxRaw) : defaultPoolMax;
    const normalizedPoolMax = Number.isFinite(poolMax) && poolMax > 0 ? poolMax : defaultPoolMax;
    const connectionTimeoutMsRaw = process.env.PG_POOL_CONNECTION_TIMEOUT_MS;
    const connectionTimeoutMs = connectionTimeoutMsRaw
        ? Number(connectionTimeoutMsRaw)
        : 30000;
    const normalizedConnectionTimeoutMs = Number.isFinite(connectionTimeoutMs) && connectionTimeoutMs > 0
        ? connectionTimeoutMs
        : 30000;
    const pool = new pg_1.Pool({
        connectionString,
        connectionTimeoutMillis: normalizedConnectionTimeoutMs,
        idleTimeoutMillis: process.env.NODE_ENV === "production" ? 30000 : 10000,
        max: normalizedPoolMax,
        min: 0,
    });
    pool.on("error", (err) => {
        console.error("Unexpected pool error:", err);
    });
    const adapter = new adapter_pg_1.PrismaPg(pool);
    return new client_1.PrismaClient({
        adapter,
        log: ["error", "warn"],
    });
}
// Prevent multiple instances in development
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
