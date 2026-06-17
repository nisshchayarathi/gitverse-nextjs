import { RepositoryFile } from "@/types/firstPRSimulator";
import {
  ArchitectureModule,
  ArchitectureSnapshot,
  ArchitectureLayer,
  DependencyPath,
  ArchitectureMetrics,
} from "@/types/architectureDrift";
import { buildDependencyGraph } from "@/lib/changeImpact";

const normalizePath = (value: string): string =>
  value
    .replace(/\\/g, "/")
    .replace(/\/\/+/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/$/, "")
    .trim();

const determineModuleType = (filePath: string): ArchitectureModule["type"] => {
  const normalized = filePath.toLowerCase();

  if (/(^|\/)app\/api\//.test(normalized) || /(^|\/)pages\/api\//.test(normalized)) {
    return "API Route";
  }
  if (/\/(hooks?)\//.test(normalized)) {
    return "Hook";
  }
  if (/\/(components?)\//.test(normalized)) {
    return "Component";
  }
  if (/\/(services?)\//.test(normalized)) {
    return "Service";
  }
  if (/\/(utils?|lib)\//.test(normalized)) {
    return "Utility";
  }
  if (/\/(pages?)\//.test(normalized)) {
    return "Page";
  }
  return "Unknown";
};

function determineLayerFromType(type: string): ArchitectureLayer {
  if (type === "API Route") return "API";
  if (type === "Service") return "Services";
  if (type === "Utility") return "Utils";
  if (type === "Page" || type === "Component" || type === "Hook") return "UI";
  return "Other";
}

const calculateModuleComplexity = (
  file: RepositoryFile,
  dependencyCount: number,
  dependentCount: number,
): number => {
  const sizeComplexity = Math.min((file.lines || 0) / 500, 1);
  const depComplexity = Math.min(dependencyCount / 10, 1);
  const dependerComplexity = Math.min(dependentCount / 5, 1);

  return Math.round((sizeComplexity * 0.4 + depComplexity * 0.4 + dependerComplexity * 0.2) * 100);
};

const extractModuleExports = (filePath: string, content?: string): string[] => {
  if (!content) return [];

  const exportPattern = /export\s+(?:const|function|class|interface|type)\s+(\w+)/g;
  const exports: string[] = [];
  let match;

  while ((match = exportPattern.exec(content))) {
    if (match[1]) {
      exports.push(match[1]);
    }
  }

  return exports;
};

export const generateArchitectureSnapshot = (
  files: RepositoryFile[],
  label: string,
  commitHash?: string,
  releaseTag?: string,
): ArchitectureSnapshot => {
  const graph = buildDependencyGraph(files);
  const modules: ArchitectureModule[] = [];

  graph.fileMap.forEach((file, normalizedPath) => {
    const dependencies = graph.importMap.get(normalizedPath) || [];
    const dependents = graph.dependentsMap.get(normalizedPath) || [];
    const type = determineModuleType(normalizedPath);
    const complexity = calculateModuleComplexity(file, dependencies.length, dependents.length);

    modules.push({
      name: normalizedPath.split("/").pop() || normalizedPath,
      path: normalizedPath,
      type,
      size: file.size || 0,
      complexity,
      dependencies,
      dependents,
      exports: extractModuleExports(normalizedPath, file.content),
      isCircular: false,
    });
  });

  const dependencies = Array.from(graph.importMap.entries()).flatMap(([source, targets]) =>
    targets.map((target) => ({
      source,
      target,
      weight: 1,
    })),
  );

  const circularDependencies = detectCircularDependencies(graph.dependentsMap, graph.importMap);
  const layerDistribution: Record<ArchitectureLayer, number> = {
    UI: 0,
    Services: 0,
    Database: 0,
    Auth: 0,
    API: 0,
    Utils: 0,
    Config: 0,
    Other: 0,
  };

  modules.forEach((mod) => {
    if (circularDependencies.has(mod.path)) {
      mod.isCircular = true;
    }

    const layer = determineLayerFromType(mod.type);
    layerDistribution[layer] += 1;
  });

  const metrics: ArchitectureMetrics = {
    moduleCount: modules.length,
    totalDependencies: dependencies.length,
    dependencyCount: dependencies.length,
    averageCoupling: modules.length > 0 ? dependencies.length / modules.length : 0,
    circularDependencyCount: circularDependencies.size,
    complexityScore:
      modules.length > 0
        ? Math.round(modules.reduce((sum, m) => sum + m.complexity, 0) / modules.length)
        : 0,
    criticalViolations: 0,
    highViolations: 0,
    mediumViolations: 0,
    lowViolations: 0,
    circularity: 0,
    coupling: Math.min(100, (dependencies.length / Math.max(modules.length, 1)) * 10),
    cohesion: modules.length > 0 ? Math.max(0, 100 - (dependencies.length / modules.length) * 2) : 100,
    healthScore: Math.max(0, 100 - (dependencies.length / Math.max(modules.length, 1)) * 5),
  };

  return {
    timestamp: new Date(),
    snapshotDate: new Date().toISOString().split("T")[0],
    label,
    commitHash,
    releaseTag,
    modules,
    dependencies,
    dependencyGraph: dependencies.map((dep) => ({
      source: dep.source,
      target: dep.target,
      layer: "Other",
      isViolation: false,
    })),
    totalDependencies: dependencies.length,
    violationCount: 0,
    moduleCount: modules.length,
    layerDistribution,
    metrics,
  };
};

const detectCircularDependencies = (
  dependentsMap: Map<string, string[]>,
  importMap: Map<string, string[]>,
): Set<string> => {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const circular = new Set<string>();

  const hasCycle = (node: string): boolean => {
    visited.add(node);
    recursionStack.add(node);

    const dependencies = importMap.get(node) || [];
    for (const dep of dependencies) {
      if (!visited.has(dep)) {
        if (hasCycle(dep)) {
          circular.add(node);
          return true;
        }
      } else if (recursionStack.has(dep)) {
        circular.add(node);
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  };

  importMap.forEach((_, node) => {
    if (!visited.has(node)) {
      hasCycle(node);
    }
  });

  return circular;
};

export const createInitialSnapshot = (files: RepositoryFile[]): ArchitectureSnapshot => {
  return generateArchitectureSnapshot(files, "Initial Snapshot");
};

export const createSnapshotFromTimestamp = (
  files: RepositoryFile[],
  timestamp: Date,
): ArchitectureSnapshot => {
  return generateArchitectureSnapshot(files, `Snapshot - ${timestamp.toLocaleDateString()}`, undefined, undefined);
};
