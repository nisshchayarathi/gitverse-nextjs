import { PrismaClient } from "@prisma/client";
import { Pool as PgPool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaNeonHttp, PrismaNeon } from "@prisma/adapter-neon";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

type PrismaAdapterChoice = "pg" | "neon-http" | "neon-ws";

function getAdapterChoice(connectionString: string): PrismaAdapterChoice {
  const envChoice = (process.env.PRISMA_ADAPTER || "").trim().toLowerCase();
  if (envChoice === "pg") return "pg";
  if (envChoice === "neon-http") return "neon-http";
  if (envChoice === "neon" || envChoice === "neon-ws") return "neon-ws";

  let host = "";
  try {
    host = new URL(connectionString).host;
  } catch {
    // Ignore URL parsing errors; fall through
  }

  const isNeonHost =
    host.endsWith(".neon.tech") || connectionString.includes("neon.tech");

  if (isNeonHost) return "neon-ws";
  return "pg";
}

function getPoolConfig() {
  const rawMax = process.env.PG_POOL_MAX;
  const isProd = process.env.NODE_ENV === "production";
  const defaultMax = isProd ? 2 : 5;
  const max = rawMax ? Number(rawMax) : defaultMax;

  const rawMin = process.env.PG_POOL_MIN;
  const defaultMin = 0;
  const min = rawMin ? Number(rawMin) : defaultMin;

  const rawConnTimeout = process.env.PG_POOL_CONNECTION_TIMEOUT_MS;
  const defaultConnTimeout = 30000;
  const connectionTimeoutMillis = rawConnTimeout
    ? Number(rawConnTimeout)
    : defaultConnTimeout;

  const rawIdleTimeout = process.env.PG_POOL_IDLE_TIMEOUT_MS;
  const defaultIdleTimeout = isProd ? 30000 : 10000;
  const idleTimeoutMillis = rawIdleTimeout
    ? Number(rawIdleTimeout)
    : defaultIdleTimeout;

  const poolMode = (process.env.PG_POOL_MODE || "").trim().toLowerCase();

  return {
    max: Number.isFinite(max) && max > 0 ? max : defaultMax,
    min: Number.isFinite(min) && min >= 0 ? min : defaultMin,
    connectionTimeoutMillis:
      Number.isFinite(connectionTimeoutMillis) && connectionTimeoutMillis > 0
        ? connectionTimeoutMillis
        : defaultConnTimeout,
    idleTimeoutMillis:
      Number.isFinite(idleTimeoutMillis) && idleTimeoutMillis > 0
        ? idleTimeoutMillis
        : defaultIdleTimeout,
    isTransactionMode: poolMode === "transaction",
  };
}

function getRetryConfig() {
  const rawMax = process.env.PG_POOL_CONNECTION_RETRY_MAX;
  const maxRetries = rawMax ? Number(rawMax) : 3;

  const rawBackoff = process.env.PG_POOL_CONNECTION_RETRY_BACKOFF_MS;
  const baseBackoffMs = rawBackoff ? Number(rawBackoff) : 500;

  return {
    maxRetries: Number.isFinite(maxRetries) && maxRetries >= 0 ? maxRetries : 3,
    baseBackoffMs:
      Number.isFinite(baseBackoffMs) && baseBackoffMs > 0
        ? baseBackoffMs
        : 500,
  };
}

function withRetry(client: PrismaClient) {
  const { maxRetries, baseBackoffMs } = getRetryConfig();

  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, model, args, query }) {
          let retries = 0;
          while (true) {
            try {
              return await query(args);
            } catch (error: any) {
              const isRetryableError =
                error?.code === "P1001" ||
                error?.code === "P2024" ||
                error?.message?.toLowerCase().includes("timeout") ||
                error?.message?.toLowerCase().includes("connection pool") ||
                error?.message?.toLowerCase().includes("connect") ||
                error?.message?.toLowerCase().includes("fetch failed");

              if (!isRetryableError || retries >= maxRetries) {
                throw error;
              }
              retries++;
              const backoff = Math.pow(2, retries) * baseBackoffMs;
              console.warn(
                `[Prisma Retry] DB connection error (attempt ${retries}/${maxRetries}). Retrying in ${backoff}ms...`
              );
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
  const poolConfig = getPoolConfig();

  if (adapterChoice === "neon-ws") {
    const pool = new NeonPool({
      connectionString,
      connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
      idleTimeoutMillis: poolConfig.idleTimeoutMillis,
      max: poolConfig.max,
    });

    pool.on("error", (err: any) => {
      console.error("Unexpected Neon WebSocket pool error:", err);
    });

    registerPool(pool as any, "neon-ws");

    const adapter = new PrismaNeon(pool as any);
    return withRetry(
      new PrismaClient({
        adapter,
        log: ["error", "warn"],
      })
    );
  }

  if (adapterChoice === "neon-http") {
    const adapter = new PrismaNeonHttp(connectionString, {} as any);
    return withRetry(new PrismaClient({ adapter, log: ["error", "warn"] }));
  }

  const pool = new PgPool({
    connectionString,
    connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
    idleTimeoutMillis: poolConfig.idleTimeoutMillis,
    max: poolConfig.max,
    min: poolConfig.min,
  });

  pool.on("error", (err) => {
    console.error("Unexpected pg TCP pool error:", err);
  });

  registerPool(pool, "pg");

  const adapter = new PrismaPg(pool);
  const prismaClientOptions: any = { adapter, log: ["error", "warn"] };

  if (poolConfig.isTransactionMode) {
    prismaClientOptions.transactionOptions = { maxWait: 2000, timeout: 10000 };
  }

  return withRetry(new PrismaClient(prismaClientOptions));
}

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

// Follow Next.js best practices for Prisma Client instantiation while retaining lazy loading
// for build-time static analysis where DATABASE_URL might not be present.

declare const globalThis: {
  prismaGlobal: ExtendedPrismaClient | undefined;
} & typeof global;

export function getPrisma(): ExtendedPrismaClient {
  if (!globalThis.prismaGlobal) {
    globalThis.prismaGlobal = createPrismaClient();
  }
  return globalThis.prismaGlobal;
}

if (process.env.NODE_ENV !== 'production') {
  // Ensure the variable is declared so that the getter can use it
  if (!globalThis.prismaGlobal) {
    try {
      // In dev, we try to initialize immediately, but catch if DB URL is missing
      // to not break tooling.
      globalThis.prismaGlobal = createPrismaClient();
    } catch (e) {
      // Ignore build time errors
    }
  }
}

// Retain the Proxy so that existing code doing `import prisma from './prisma'`
// can immediately call `prisma.user.findMany()` without changing to `getPrisma().user.findMany()`
const prisma = new Proxy({} as ExtendedPrismaClient, {
  get(_target, prop) {
    const client = getPrisma() as unknown as Record<PropertyKey, unknown>;
    return client[prop];
  },
});

export default prisma;
export { prisma };

// --- Connection pool lifecycle management ---

export { getPoolConfig };

export interface PoolMetrics {
  adapter: string;
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
}

const pools: Array<{ pool: PgPool | NeonPool; adapter: string }> = [];

function registerPool(pool: PgPool | NeonPool, adapter: string): void {
  pools.push({ pool, adapter });
}

export function getPoolMetrics(): PoolMetrics[] {
  return pools.map(({ pool, adapter }) => ({
    adapter,
    totalConnections: (pool as any).totalCount ?? 0,
    idleConnections: (pool as any).idleCount ?? 0,
    waitingClients: (pool as any).waitingCount ?? 0,
  }));
}

let disconnectInProgress = false;

const defaultDisconnectTimeoutMs = 10_000;

export async function disconnectPrisma(
  options?: { timeoutMs?: number }
): Promise<void> {
  if (disconnectInProgress) return;
  disconnectInProgress = true;

  const client = globalThis.prismaGlobal;
  if (client) {
    globalThis.prismaGlobal = undefined;
    try {
      const timeoutMs = options?.timeoutMs ?? defaultDisconnectTimeoutMs;
      const disconnect = client.$disconnect();
      const timer = timeoutMs > 0
        ? new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("disconnect timed out")), timeoutMs)
          )
        : null;
      await (timer ? Promise.race([disconnect, timer]) : disconnect);
    } catch (err: any) {
      const isTimeout = err?.message === "disconnect timed out";
      console.warn(
        isTimeout
          ? "[Prisma] disconnect timed out — forcing cleanup"
          : `[Prisma] disconnect error: ${err?.message ?? err}`
      );
    }
  }
  disconnectInProgress = false;
}

export interface PoolHealth {
  healthy: boolean;
  activePools: number;
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
  metrics: PoolMetrics[];
}

export function getPoolHealth(): PoolHealth {
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

// Safety net: when the process exits naturally (event loop drains), disconnect
// Note: this does NOT fire on process.exit() — callers must await disconnectPrisma() first.
process.once("beforeExit", async () => {
  if (globalThis.prismaGlobal) {
    await disconnectPrisma();
  }
});
