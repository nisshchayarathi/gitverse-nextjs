import { DependencyGraphService } from "../../services/dependency-graph";
import { GraphAnalyzer } from "../../../src/utils/graphAnalyzer";

describe("Circular Dependency Analysis Tests", () => {
  it("should analyze circular downstream dependencies safely", () => {
    const service = new DependencyGraphService();
    
    // Mock dependency graph:
    // A imports B => B's dependents = [A]
    // B imports C => C's dependents = [B]
    // C imports A => A's dependents = [C]
    const graph = new Map<string, string[]>();
    graph.set("B", ["A"]);
    graph.set("C", ["B"]);
    graph.set("A", ["C"]);

    const visited = new Set<string>();
    const dependents = service.getDownstreamDependents(graph, ["B"], 5, visited);
    
    expect(dependents).toContain("A");
    expect(dependents).toContain("C");
    expect(dependents).not.toContain("B"); // the changed file itself is removed from final affected list
    expect(visited.has("B")).toBe(true);
    expect(visited.has("A")).toBe(true);
    expect(visited.has("C")).toBe(true);
  });

  it("should detect cycles and set isCyclic true in GraphAnalyzer", () => {
    const analyzer = new GraphAnalyzer();
    
    // Mock circular file dependencies:
    // A imports B, B imports C, C imports A
    const mockFiles = [
      { path: "src/fileA.ts", dependencies: ["src/fileB.ts"] },
      { path: "src/fileB.ts", dependencies: ["src/fileC.ts"] },
      { path: "src/fileC.ts", dependencies: ["src/fileA.ts"] },
      { path: "src/fileD.ts", dependencies: ["src/fileA.ts"] } // non-cyclic dependent
    ];

    const result = analyzer.buildDependencyGraph(mockFiles);
    
    const linkAB = result.links.find(l => l.source === "file-src/fileA.ts" && l.target === "file-src/fileB.ts");
    const linkBC = result.links.find(l => l.source === "file-src/fileB.ts" && l.target === "file-src/fileC.ts");
    const linkCA = result.links.find(l => l.source === "file-src/fileC.ts" && l.target === "file-src/fileA.ts");
    const linkDA = result.links.find(l => l.source === "file-src/fileD.ts" && l.target === "file-src/fileA.ts");

    expect(linkAB?.isCyclic).toBe(true);
    expect(linkBC?.isCyclic).toBe(true);
    expect(linkCA?.isCyclic).toBe(true);
    expect(linkDA?.isCyclic).toBe(false);
  });
});
