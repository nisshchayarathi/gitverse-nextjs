import { ShardRouter } from "../sharding/shard-router";
import { ShardMigrationWorker } from "../../workers/shard-migration-worker";
import { ShardRegistry } from "../sharding/shard-registry";

describe("RAG Vector Database Sharding", () => {
  let router: ShardRouter;
  let worker: ShardMigrationWorker;

  beforeEach(() => {
    router = new ShardRouter();
    worker = new ShardMigrationWorker();
    
    // Ensure test environment uses mocked shards from registry default
    const registry = ShardRegistry.getInstance();
    registry.updateShardStatus("shard-1", true);
    registry.updateShardStatus("shard-2", true);
    registry.updateShardStatus("shard-3", true);
  });

  describe("ShardRouter", () => {
    it("Scenario 1 & 2: Should route deterministic organizations to specific shards", () => {
      // Deterministic routing verification
      const shardA = router.getTargetShard("org-a-uuid");
      const shardB = router.getTargetShard("org-b-uuid");

      expect(shardA).toBeDefined();
      expect(shardB).toBeDefined();

      // Ensure stable hashing
      expect(router.getTargetShard("org-a-uuid")).toBe(shardA);
    });

    it("Scenario 5: Should throw error if no shards available", () => {
      const registry = ShardRegistry.getInstance();
      registry.updateShardStatus("shard-1", false);
      registry.updateShardStatus("shard-2", false);
      registry.updateShardStatus("shard-3", false);

      expect(() => router.getTargetShard("org-a-uuid")).toThrow("No active shards available");
    });
  });

  describe("ShardMigrationWorker", () => {
    it("Scenario 3 & 6: Should execute successful migration and override routing", async () => {
      // Reset shards
      const registry = ShardRegistry.getInstance();
      registry.updateShardStatus("shard-1", true);
      registry.updateShardStatus("shard-2", true);
      registry.updateShardStatus("shard-3", true);

      const orgId = "migrating-org-uuid";
      
      const jobId = await worker.startMigration(orgId, "shard-1", "shard-2");
      
      // Wait for state machine to complete (using mocks, takes ~1s)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const status = worker.getJobStatus(jobId);
      expect(status?.state).toBe("COMPLETED");
      expect(status?.progressPercent).toBe(100);

      // Verify routing was switched
      // NOTE: Our test router instance uses the global override map from the singleton,
      // but the worker imports the singleton router directly. 
      // We will check the module-level singleton here to ensure side effects happened.
      const { shardRouter } = require("../sharding/shard-router");
      expect(shardRouter.getTargetShard(orgId)).toBe("shard-2");
    });
  });
});
