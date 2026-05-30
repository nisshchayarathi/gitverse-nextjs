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
  const defaultPoolMax = process.env.NODE_ENV === "production" ? 2 : 1;
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

  const adapter = new PrismaPg(pool);

  return withRetry(new PrismaClient({
    adapter,
    log: ["error", "warn"],
  }));
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export function getPrisma(): ExtendedPrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}

const prisma = new Proxy({} as ExtendedPrismaClient, {
  get(_target, prop) {
    const client = getPrisma() as unknown as Record<PropertyKey, unknown>;
    return client[prop];
  },
});

export default prisma;
export { prisma };
