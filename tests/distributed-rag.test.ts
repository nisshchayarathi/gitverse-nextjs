import { crossRepoImpactService } from "../lib/services/cross-repo-impact";
import { orgKnowledgeGraph } from "../lib/services/org-knowledge-graph";

describe("Distributed RAG Indexing and Cross-Repo Analysis", () => {
  beforeEach(() => {
    (orgKnowledgeGraph as any).nodes.clear();
    (orgKnowledgeGraph as any).edges = [];
  });

  test("Scenario 1: Shared types -> frontend + backend", () => {
    orgKnowledgeGraph.addNode({ id: "shared-types/User.ts", type: "file", metadata: {}, dependencies: [], dependents: [] });
    orgKnowledgeGraph.addNode({ id: "frontend-web", type: "repository", metadata: {}, dependencies: [], dependents: [] });
    orgKnowledgeGraph.addNode({ id: "backend-api", type: "repository", metadata: {}, dependencies: [], dependents: [] });

    orgKnowledgeGraph.addDependency({ sourceRepo: "shared-types", targetRepo: "frontend-web", sourceFile: "User.ts", dependencyType: "import" });
    orgKnowledgeGraph.addDependency({ sourceRepo: "shared-types", targetRepo: "backend-api", sourceFile: "User.ts", dependencyType: "import" });

    const report = crossRepoImpactService.analyzeImpact("shared-types", ["User.ts"]);
    
    expect(report.potentiallyAffectedRepositories).toContain("frontend-web");
    expect(report.potentiallyAffectedRepositories).toContain("backend-api");
    expect(report.risk).toBe("High");
    expect(report.reason).toContain("Shared types or interfaces were modified");
  });

  test("Scenario 2: SDK -> multiple services", () => {
    orgKnowledgeGraph.addNode({ id: "service-auth", type: "repository", metadata: {}, dependencies: [], dependents: [] });
    orgKnowledgeGraph.addNode({ id: "service-billing", type: "repository", metadata: {}, dependencies: [], dependents: [] });
    orgKnowledgeGraph.addNode({ id: "service-analytics", type: "repository", metadata: {}, dependencies: [], dependents: [] });

    orgKnowledgeGraph.addDependency({ sourceRepo: "core-sdk", targetRepo: "service-auth", sourceFile: "api.ts", dependencyType: "sdk" });
    orgKnowledgeGraph.addDependency({ sourceRepo: "core-sdk", targetRepo: "service-billing", sourceFile: "api.ts", dependencyType: "sdk" });
    orgKnowledgeGraph.addDependency({ sourceRepo: "core-sdk", targetRepo: "service-analytics", sourceFile: "api.ts", dependencyType: "sdk" });

    const report = crossRepoImpactService.analyzeImpact("core-sdk", ["api.ts"]);
    
    expect(report.potentiallyAffectedRepositories).toHaveLength(3);
    expect(report.risk).toBe("High");
  });

  test("Scenario 3: Breaking API contract change", () => {
    orgKnowledgeGraph.addDependency({ sourceRepo: "backend-api", targetRepo: "mobile-app", sourceFile: "routes/user.ts", dependencyType: "api" });

    const report = crossRepoImpactService.analyzeImpact("backend-api", ["routes/user.ts"]);
    expect(report.potentiallyAffectedRepositories).toContain("mobile-app");
    expect(report.risk).toBe("Medium");
  });

  test("Scenario 4: Repository added/removed from organization", () => {
    orgKnowledgeGraph.addDependency({ sourceRepo: "A", targetRepo: "B", sourceFile: "index.ts", dependencyType: "import" });
    orgKnowledgeGraph.addDependency({ sourceRepo: "B", targetRepo: "C", sourceFile: "index.ts", dependencyType: "import" });
    orgKnowledgeGraph.addDependency({ sourceRepo: "C", targetRepo: "D", sourceFile: "index.ts", dependencyType: "import" });

    const report = crossRepoImpactService.analyzeImpact("A", ["index.ts"]);
    expect(report.potentiallyAffectedRepositories).toContain("B");
    expect(report.potentiallyAffectedRepositories).toContain("C");
    expect(report.potentiallyAffectedRepositories).toContain("D");
  });
});
