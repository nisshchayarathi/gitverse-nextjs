import { PrismaClient } from "@prisma/client";
import { Pool as PgPool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaNeonHttp, PrismaNeon } from "@prisma/adapter-neon";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Set webSocketConstructor so @neondatabase/serverless works via WebSockets in Node.js/serverless environments
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

function withRetry(client: PrismaClient) {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, model, args, query }) {
          let retries = 0;
          const maxRetries = 3;
          while (true) {
            try {
              return await query(args);
            } catch (error: any) {
              const isColdStartError =
                error?.code === 'P1001' ||
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
  // Reduce default production pool max to 2 to prevent exhaustion in serverless scaling
  const defaultPoolMax = process.env.NODE_ENV === "production" ? 2 : 5;
  const poolMax = poolMaxRaw ? Number(poolMaxRaw) : defaultPoolMax;
  const normalizedPoolMax =
    Number.isFinite(poolMax) && poolMax > 0 ? poolMax : defaultPoolMax;

  const connectionTimeoutMsRaw = process.env.PG_POOL_CONNECTION_TIMEOUT_MS;
  const connectionTimeoutMs = connectionTimeoutMsRaw
    ? Number(connectionTimeoutMsRaw)
    : 30000;
  const normalizedConnectionTimeoutMs =
    Number.isFinite(connectionTimeoutMs) && connectionTimeoutMs > 0
      ? connectionTimeoutMs
      : 30000;

  if (adapterChoice === "neon-ws") {
    // 1. WebSocket-based pooled adapter for Neon in serverless environment
    const pool = new NeonPool({
      connectionString,
      connectionTimeoutMillis: normalizedConnectionTimeoutMs,
      idleTimeoutMillis: process.env.NODE_ENV === "production" ? 30000 : 10000,
      max: normalizedPoolMax,
    });

    pool.on("error", (err: any) => {
      console.error("Unexpected Neon WebSocket pool error:", err);
    });

    registerPool(pool as any, "neon-ws");

    const adapter = new PrismaNeon(pool as any);
    return withRetry(new PrismaClient({
      adapter,
      log: ["error", "warn"],
    }));
  }

  if (adapterChoice === "neon-http") {
    // 2. HTTP-based fetch adapter for Neon (no pooling)
    const adapter = new PrismaNeonHttp(connectionString, {} as any);
    return withRetry(new PrismaClient({ adapter, log: ["error", "warn"] }));
  }

  // 3. Default: pg TCP connection pool adapter
  const pool = new PgPool({
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

  const adapter = new PrismaPg(pool);

  return withRetry(new PrismaClient({
    adapter,
    log: ["error", "warn"],
  }));
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
