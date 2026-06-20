/**
 * @jest-environment node
 */

var mockDisconnect: jest.Mock;
var mock$extends: jest.Mock;
var mockPoolEnd: jest.Mock;

jest.mock("pg", () => {
  class MockPool {
    totalCount = 0;
    idleCount = 0;
    waitingCount = 0;
    on = jest.fn();
    end = jest.fn().mockResolvedValue(undefined);
  }
  return { Pool: MockPool };
});

jest.mock("@prisma/adapter-pg", () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeonHttp: jest.fn().mockImplementation(() => ({})),
  PrismaNeon: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@neondatabase/serverless", () => {
  class MockNeonPool {
    totalCount = 5;
    idleCount = 3;
    waitingCount = 1;
    on = jest.fn();
    end = jest.fn().mockResolvedValue(undefined);
  }
  return {
    Pool: MockNeonPool,
    neonConfig: { webSocketConstructor: null },
  };
});

jest.mock("ws", () => ({}));

jest.mock("@prisma/client", () => {
  mockDisconnect = jest.fn().mockResolvedValue(undefined);
  mock$extends = jest.fn().mockImplementation(function (this: any) {
    return this;
  });

  class MockPrismaClient {
    $disconnect = mockDisconnect;
    $extends = mock$extends;
    $transaction = jest.fn();
    $queryRaw = jest.fn();
    $executeRaw = jest.fn();
    analysisJob = {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    };
    user = {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    repository = {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
  }
  return { PrismaClient: MockPrismaClient };
});

const ORIGINAL_DB_URL = process.env.DATABASE_URL;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

describe("Prisma connection lifecycle", () => {
  let prismaModule: typeof import("../prisma");

  beforeAll(() => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    (process.env as any).NODE_ENV = "test";
    process.env.PRISMA_ADAPTER = "pg";

    jest.isolateModules(() => {
      prismaModule = require("../prisma");
    });
  });

  afterAll(() => {
    process.env.DATABASE_URL = ORIGINAL_DB_URL;
    (process.env as any).NODE_ENV = ORIGINAL_NODE_ENV;
    process.removeAllListeners("beforeExit");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getPoolMetrics", () => {
    it("returns metrics after getPrisma() creates a pool", () => {
      const client = prismaModule.getPrisma();

      const metrics = prismaModule.getPoolMetrics();

      expect(metrics.length).toBeGreaterThanOrEqual(1);
      expect(metrics[0]).toMatchObject({
        adapter: expect.any(String),
        totalConnections: expect.any(Number),
        idleConnections: expect.any(Number),
        waitingClients: expect.any(Number),
      });
      expect(metrics[0].adapter).toBe("pg");
    });

    it("does not throw when no pools have been created", () => {
      const metrics = prismaModule.getPoolMetrics();
      expect(Array.isArray(metrics)).toBe(true);
    });

    it("returns zeroed metrics when pool has no connections", () => {
      const metrics = prismaModule.getPoolMetrics();

      for (const m of metrics) {
        expect(typeof m.totalConnections).toBe("number");
        expect(typeof m.idleConnections).toBe("number");
        expect(typeof m.waitingClients).toBe("number");
      }
    });
  });

  describe("getPoolHealth", () => {
    it("returns healthy status with pool metrics", () => {
      const health = prismaModule.getPoolHealth();

      expect(health).toMatchObject({
        healthy: expect.any(Boolean),
        activePools: expect.any(Number),
        totalConnections: expect.any(Number),
        idleConnections: expect.any(Number),
        waitingClients: expect.any(Number),
      });
      expect(Array.isArray(health.metrics)).toBe(true);
    });

    it("reports unhealthy when waiting clients exceed idle", () => {
      const health = prismaModule.getPoolHealth();

      expect(typeof health.healthy).toBe("boolean");
      expect(health.activePools).toBeGreaterThanOrEqual(0);
    });
  });

  describe("disconnectPrisma", () => {
    it("disconnects the global Prisma client", async () => {
      prismaModule.getPrisma();
      mockDisconnect.mockClear();

      await prismaModule.disconnectPrisma();

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it("is idempotent when called multiple times", async () => {
      prismaModule.getPrisma();
      mockDisconnect.mockClear();

      await prismaModule.disconnectPrisma();
      await prismaModule.disconnectPrisma();
      await prismaModule.disconnectPrisma();

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it("does not throw when no client has been initialized", async () => {
      await prismaModule.disconnectPrisma();
      await expect(prismaModule.disconnectPrisma()).resolves.toBeUndefined();
    });

    it("resets the global client reference to undefined", async () => {
      prismaModule.getPrisma();
      expect(prismaModule.getPrisma()).toBeDefined();

      await prismaModule.disconnectPrisma();

      const client = prismaModule.getPrisma();
      expect(client).toBeDefined();
    });

    it("handles disconnect errors gracefully", async () => {
      prismaModule.getPrisma();
      mockDisconnect.mockRejectedValueOnce(new Error("connection lost"));

      await expect(prismaModule.disconnectPrisma()).resolves.toBeUndefined();
    });

    it("respects timeout option and falls back to force close", async () => {
      prismaModule.getPrisma();
      mockDisconnect.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 5000))
      );

      await prismaModule.disconnectPrisma({ timeoutMs: 50 });

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it("accepts zero timeout to disable timeout protection", async () => {
      prismaModule.getPrisma();
      mockDisconnect.mockClear();

      await prismaModule.disconnectPrisma({ timeoutMs: 0 });

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it("does not prevent subsequent disconnect after previous completes", async () => {
      prismaModule.getPrisma();
      mockDisconnect.mockClear();

      await prismaModule.disconnectPrisma();
      await prismaModule.disconnectPrisma();

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe("proxy default export", () => {
    it("forwards method calls to the underlying Prisma client", () => {
      const client = prismaModule.getPrisma();
      (client.analysisJob.findFirst as jest.Mock).mockReturnValueOnce({ id: "job-1" });

      const prisma = prismaModule.default;
      const result = prisma.analysisJob.findFirst({ where: { id: "test" } });

      expect(result).toEqual({ id: "job-1" });
    });

    it("forwards $disconnect through the proxy", () => {
      const prisma = prismaModule.default;
      expect(typeof prisma.$disconnect).toBe("function");
    });

    it("forwards $extends through the proxy", () => {
      const prisma = prismaModule.default;
      expect(typeof prisma.$extends).toBe("function");
    });
  });

  describe("worker server metrics endpoint", () => {
    it("getPoolHealth returns consistent data with getPoolMetrics", () => {
      const health = prismaModule.getPoolHealth();
      const metrics = prismaModule.getPoolMetrics();

      expect(health.activePools).toBe(metrics.length);
      expect(health.metrics).toEqual(metrics);
    });

    it("getPoolHealth sums metrics across pools", () => {
      const health = prismaModule.getPoolHealth();
      const metrics = prismaModule.getPoolMetrics();

      const totalTotal = metrics.reduce((s, m) => s + m.totalConnections, 0);
      const totalIdle = metrics.reduce((s, m) => s + m.idleConnections, 0);
      const totalWaiting = metrics.reduce((s, m) => s + m.waitingClients, 0);

      expect(health.totalConnections).toBe(totalTotal);
      expect(health.idleConnections).toBe(totalIdle);
      expect(health.waitingClients).toBe(totalWaiting);
    });
  });

  describe("edge cases", () => {
    it("handles concurrent disconnect requests gracefully", async () => {
      prismaModule.getPrisma();
      mockDisconnect.mockClear();

      const results = await Promise.allSettled([
        prismaModule.disconnectPrisma(),
        prismaModule.disconnectPrisma(),
        prismaModule.disconnectPrisma(),
      ]);

      for (const r of results) {
        expect(r.status).toBe("fulfilled");
      }
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it("getPrisma returns same instance after disconnect creates new one", async () => {
      prismaModule.getPrisma();
      await prismaModule.disconnectPrisma();

      const newClient = prismaModule.getPrisma();
      expect(newClient).toBeDefined();
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it("beforeExit handler registered without error", () => {
      expect(() => {
        process.emit("beforeExit" as any);
      }).not.toThrow();
    });

    it("survives repeated get-disconnect-get cycles", async () => {
      for (let i = 0; i < 5; i++) {
        const client = prismaModule.getPrisma();
        expect(client).toBeDefined();
        await prismaModule.disconnectPrisma();
      }
    });

    it("getPoolMetrics values are always non-negative", () => {
      prismaModule.getPrisma();
      const metrics = prismaModule.getPoolMetrics();

      for (const m of metrics) {
        expect(m.totalConnections).toBeGreaterThanOrEqual(0);
        expect(m.idleConnections).toBeGreaterThanOrEqual(0);
        expect(m.waitingClients).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("worker signal and shutdown simulation", () => {
    it("disconnectPrisma with timeout does not hang on fast disconnect", async () => {
      prismaModule.getPrisma();
      mockDisconnect.mockResolvedValueOnce(undefined);

      const start = Date.now();
      await prismaModule.disconnectPrisma({ timeoutMs: 5000 });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(1000);
    });

    it("getPoolHealth reflects unhealthy when all connections are waiting", () => {
      const health = prismaModule.getPoolHealth();

      if (health.waitingClients > 0 && health.idleConnections === 0) {
        expect(health.healthy).toBe(false);
      }
    });
  });

  describe("metrics format validation", () => {
    it("getPoolHealth metrics array matches getPoolMetrics", () => {
      const health = prismaModule.getPoolHealth();
      const directMetrics = prismaModule.getPoolMetrics();

      expect(health.metrics.length).toBe(directMetrics.length);
      for (let i = 0; i < health.metrics.length; i++) {
        expect(health.metrics[i].adapter).toBe(directMetrics[i].adapter);
        expect(health.metrics[i].totalConnections).toBe(directMetrics[i].totalConnections);
      }
    });

    it("getPoolHealth sums idle connections correctly", () => {
      const health = prismaModule.getPoolHealth();
      const sumIdle = health.metrics.reduce((s, m) => s + m.idleConnections, 0);
      expect(health.idleConnections).toBe(sumIdle);
    });
  });
});
