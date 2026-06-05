export type ChangeImpactRiskLevel = "Low" | "Medium" | "High";

export interface RepositoryFile {
  path: string;
  name?: string;
  size?: number;
  lines?: number;
  extension?: string;
  language?: string;
  imports?: string[];
  exports?: string[];
  content?: string;
}

export interface ChangeImpactResult {
  filePath: string;
  directDependencies: string[];
  indirectDependencies: string[];
  dependencyDepth: number;
  riskScore: number;
  riskLevel: ChangeImpactRiskLevel;
  criticalModuleWeight: number;
  affectedAreas: string[];
  recommendedTests: string[];
  dependencyDetails: {
    direct: string[];
    indirect: string[];
  };
}

const pathSeparator = "/";
const pathExtensions = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"];

const normalizePath = (value: string): string =>
  value
    .replace(/\\/g, pathSeparator)
    .replace(/\/+/g, pathSeparator)
    .replace(/^\/+/, "")
    .replace(/\/$/, "")
    .trim();

const getDirectory = (filePath: string): string => {
  const normalized = normalizePath(filePath);
  const parts = normalized.split(pathSeparator);
  return parts.slice(0, -1).join(pathSeparator);
};

const resolvePathSegments = (segments: string[]): string[] => {
  const resolved: string[] = [];
  for (const segment of segments) {
    if (segment === "..") {
      resolved.pop();
    } else if (segment !== "." && segment !== "") {
      resolved.push(segment);
    }
  }
  return resolved;
};

const parseImportSources = (file: RepositoryFile): string[] => {
  if (file.imports && Array.isArray(file.imports) && file.imports.length > 0) {
    return file.imports.map((source) => String(source).trim()).filter(Boolean);
  }

  if (!file.content || typeof file.content !== "string") {
    return [];
  }

  const importSources: string[] = [];
  const importPattern = /(?:import\s+(?:[^'"]+\s+from\s+)?|export\s+(?:\*\s+from\s+|\{[^}]*\}\s+from\s+)|require\()\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = importPattern.exec(file.content))) {
    if (match[1]) {
      importSources.push(match[1]);
    }
  }

  return importSources;
};

const candidateFilePaths = (importPath: string): string[] => {
  const candidates: string[] = [];
  const normalizedImport = normalizePath(importPath);

  if (normalizedImport === "") {
    return candidates;
  }

  if (normalizedImport.endsWith(pathSeparator)) {
    pathExtensions.forEach((ext) => {
      candidates.push(`${normalizedImport}index${ext}`);
    });
  } else {
    pathExtensions.forEach((ext) => {
      candidates.push(`${normalizedImport}${ext}`);
    });
    pathExtensions.forEach((ext) => {
      candidates.push(`${normalizedImport}/index${ext}`);
    });
  }

  return candidates;
};

const findMatchingFilePath = (
  importSource: string,
  currentFilePath: string,
  filePaths: string[],
): string | null => {
  const cleaned = normalizePath(importSource);
  const currentDir = getDirectory(currentFilePath);

  const tryCandidates = (candidatePath: string): string | null => {
    const normalizedCandidate = normalizePath(candidatePath);
    const exact = filePaths.find((filePath) => filePath === normalizedCandidate);
    if (exact) return exact;
    return filePaths.find((filePath) => filePath.endsWith(`/${normalizedCandidate}`));
  };

  if (cleaned.startsWith(".")) {
    const segments = [...currentDir.split(pathSeparator), ...cleaned.split(pathSeparator)];
    const resolvedSegments = resolvePathSegments(segments);
    for (const candidate of candidateFilePaths(resolvedSegments.join(pathSeparator))) {
      const match = tryCandidates(candidate);
      if (match) return match;
    }
    return null;
  }

  if (cleaned.startsWith(pathSeparator)) {
    for (const candidate of candidateFilePaths(cleaned.slice(1))) {
      const match = tryCandidates(candidate);
      if (match) return match;
    }
    return null;
  }

  // Non-relative imports: try to match a suffix path in the repository and support aliases.
  for (const candidate of candidateFilePaths(cleaned)) {
    const match = tryCandidates(candidate);
    if (match) return match;
  }

  return null;
};

export interface DependencyGraph {
  fileMap: Map<string, RepositoryFile>;
  importMap: Map<string, string[]>;
  dependentsMap: Map<string, string[]>;
}

export const buildDependencyGraph = (
  files: RepositoryFile[],
): DependencyGraph => {
  const fileMap = new Map<string, RepositoryFile>();
  const filePaths = files
    .map((file) => normalizePath(file.path))
    .filter(Boolean);

  files.forEach((file) => {
    const normalizedPath = normalizePath(file.path || "");
    if (normalizedPath) {
      fileMap.set(normalizedPath, file);
    }
  });

  const importMap = new Map<string, string[]>();
  const dependentsMap = new Map<string, string[]>();

  fileMap.forEach((file, filePath) => {
    const importSources = parseImportSources(file);
    const resolvedImports = importSources
      .map((source) => findMatchingFilePath(source, filePath, filePaths))
      .filter((resolved): resolved is string => Boolean(resolved));

    importMap.set(filePath, Array.from(new Set(resolvedImports)));
    resolvedImports.forEach((dependencyPath) => {
      const dependents = dependentsMap.get(dependencyPath) || [];
      if (!dependents.includes(filePath)) {
        dependents.push(filePath);
      }
      dependentsMap.set(dependencyPath, dependents);
    });
  });

  return {
    fileMap,
    importMap,
    dependentsMap,
  };
};

const getCriticalModuleWeight = (filePath: string): number => {
  const normalized = filePath.toLowerCase();
  if (/(^|\/)auth(\/|$)|(^|\/)security(\/|$)|(^|\/)session(\/|$)/.test(normalized)) {
    return 4;
  }
  if (/(^|\/)middleware(\/|$)|(^|\/)api(\/|$)|(^|\/)routes(\/|$)|(^|\/)services(\/|$)|(^|\/)config(\/|$)/.test(normalized)) {
    return 3;
  }
  if (/(^|\/)utils?(\/|$)|(^|\/)lib(\/|$)|(^|\/)shared(\/|$)|(^|\/)core(\/|$)/.test(normalized)) {
    return 2;
  }
  return 1;
};

const determineRiskLevel = (score: number): ChangeImpactRiskLevel => {
  if (score >= 12) return "High";
  if (score >= 6) return "Medium";
  return "Low";
};

const inferAffectedAreas = (
  filePath: string,
  dependentPaths: string[],
): string[] => {
  const labels = new Set<string>();
  const candidates = [filePath, ...dependentPaths];

  candidates.forEach((path) => {
    const normalized = path.toLowerCase();
    if (/(^|\/)auth(\/|$)|(^|\/)sign(in|out)?(\/|$)|(^|\/)login(\/|$)/.test(normalized)) {
      labels.add("Authentication");
    }
    if (/(^|\/)session(\/|$)|token(\/|$)|cookie(\/|$)/.test(normalized)) {
      labels.add("Session Management");
    }
    if (/(^|\/)middleware(\/|$)|(^|\/)edge(\/|$)|(^|\/)server(\/|$)/.test(normalized)) {
      labels.add("Middleware");
    }
    if (/(^|\/)api(\/|$)|(^|\/)endpoint(\/|$)/.test(normalized)) {
      labels.add("API Services");
    }
    if (/(^|\/)components?(\/|$)|(^|\/)ui(\/|$)/.test(normalized)) {
      labels.add("User Interface");
    }
    if (/(^|\/)hooks?(\/|$)/.test(normalized)) {
      labels.add("Shared Logic");
    }
    if (/(^|\/)utils?(\/|$)|(^|\/)lib(\/|$)/.test(normalized)) {
      labels.add("Utilities");
    }
    if (/(^|\/)tests?(\/|$)|(^|\/)spec(\/|$)|\.test\./.test(normalized)) {
      labels.add("Test Coverage");
    }
  });

  if (labels.size === 0) {
    const topSegment = normalizePath(filePath).split(pathSeparator)[0];
    if (topSegment) {
      labels.add(topSegment.charAt(0).toUpperCase() + topSegment.slice(1));
    } else {
      labels.add("Core Application");
    }
  }

  return Array.from(labels).slice(0, 5);
};

const buildRecommendedTests = (
  affectedAreas: string[],
  riskLevel: ChangeImpactRiskLevel,
): string[] => {
  const tests = new Set<string>();

  if (affectedAreas.includes("Authentication")) {
    tests.add("Login Flow");
    tests.add("Session Refresh");
    tests.add("Authorization Validation");
  }

  if (affectedAreas.includes("API Services")) {
    tests.add("API Contract");
    tests.add("Endpoint Regression");
  }

  if (affectedAreas.includes("User Interface")) {
    tests.add("Component Regression");
    tests.add("User Interaction");
  }

  if (affectedAreas.includes("Middleware")) {
    tests.add("Integration Tests");
    tests.add("Request Pipeline Verification");
  }

  if (tests.size === 0) {
    tests.add("Regression Suite");
    tests.add("Integration Smoke Test");
  }

  if (riskLevel === "High") {
    tests.add("Full Regression Suite");
  }

  return Array.from(tests).slice(0, 5);
};

export const calculateChangeImpact = (
  targetFile: RepositoryFile,
  graph: DependencyGraph,
): ChangeImpactResult | null => {
  const filePath = normalizePath(targetFile.path || "");
  if (!filePath || !graph.fileMap.has(filePath)) {
    return null;
  }

  const directDependencies = Array.from(new Set(graph.dependentsMap.get(filePath) || []));
  const reachable = new Map<string, number>();
  let maxDepth = 0;

  const queue = directDependencies.map((path) => ({ path, depth: 1 }));
  directDependencies.forEach((path) => reachable.set(path, 1));

  while (queue.length > 0) {
    const { path, depth } = queue.shift() as { path: string; depth: number };
    maxDepth = Math.max(maxDepth, depth);

    const children = graph.dependentsMap.get(path) || [];
    children.forEach((child) => {
      if (child === filePath || reachable.has(child)) return;
      reachable.set(child, depth + 1);
      queue.push({ path: child, depth: depth + 1 });
    });
  }

  const directCount = directDependencies.length;
  const indirectDependencies = Array.from(reachable.keys()).filter(
    (dependency) => !directDependencies.includes(dependency),
  );
  const indirectCount = indirectDependencies.length;
  const criticalModuleWeight = getCriticalModuleWeight(filePath);
  const riskScore = directCount * 2 + indirectCount + criticalModuleWeight;
  const riskLevel = determineRiskLevel(riskScore);
  const affectedAreas = inferAffectedAreas(filePath, Array.from(reachable.keys()));
  const recommendedTests = buildRecommendedTests(affectedAreas, riskLevel);

  return {
    filePath,
    directDependencies,
    indirectDependencies,
    dependencyDepth: Math.max(maxDepth, 0),
    riskScore,
    riskLevel,
    criticalModuleWeight,
    affectedAreas,
    recommendedTests,
    dependencyDetails: {
      direct: directDependencies,
      indirect: indirectDependencies,
    },
  };
};
