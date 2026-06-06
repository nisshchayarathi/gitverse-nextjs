import { buildDependencyGraph } from "@/lib/changeImpact";
import { RepositoryFile } from "@/types/firstPRSimulator";
import { DeadCodeCategory, DeadCodeFinding, DeadCodeReport } from "@/types/deadCodeDetector";

const normalizePath = (value: string): string =>
  value
    .replace(/\\/g, "/")
    .replace(/\/\/+/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/$/, "")
    .trim();

const determineCategory = (filePath: string): DeadCodeCategory => {
  const normalized = filePath.toLowerCase();

  if (/(^|\/)app\/api\//.test(normalized) || /(^|\/)pages\/api\//.test(normalized)) {
    return "API Route";
  }
  if (/\/(hooks?)\//.test(normalized)) {
    return "Hook";
  }
  if (/\/(components?)\//.test(normalized) || /\.tsx?$/.test(normalized) && /\/ui\//.test(normalized)) {
    return "Component";
  }
  if (/\/(services?)\//.test(normalized)) {
    return "Service";
  }
  if (/\/(utils?|lib)\//.test(normalized)) {
    return "Utility";
  }
  if (/\/(pages?)\//.test(normalized) || /(^|\/)index\.(ts|tsx|js|jsx)$/.test(normalized) || /(^|\/)route\.(ts|tsx|js|jsx)$/.test(normalized)) {
    return "Page/Module";
  }
  return "Unknown";
};

const isLegacyPath = (filePath: string): boolean =>
  /(^|\/)(legacy|deprecated|old|unused|archive)(\/|$)/i.test(filePath);

const isTestOrStoryFile = (filePath: string): boolean =>
  /(\/__tests__\/|\.test\.|\.spec\.|\/stories?\/|\.stories\.)/i.test(filePath);

const buildFinding = (
  file: RepositoryFile,
  incomingReferences: number,
  category: DeadCodeCategory,
): DeadCodeFinding => {
  const normalizedPath = normalizePath(file.path || "");
  const legacyBonus = isLegacyPath(normalizedPath) ? 10 : 0;
  const categoryPenalty = category === "API Route" || category === "Page/Module" ? 20 : 0;

  const baseScore = Math.max(0, 100 - incomingReferences * 20 - categoryPenalty);
  const confidence = Math.min(100, Math.max(0, baseScore + legacyBonus));

  const reasonParts = [] as string[];
  if (incomingReferences === 0) {
    reasonParts.push("No incoming import references detected.");
  } else {
    reasonParts.push(`${incomingReferences} incoming reference${incomingReferences === 1 ? "" : "s"} detected.`);
  }
  if (isLegacyPath(normalizedPath)) {
    reasonParts.push("This file path contains legacy naming patterns.");
  }
  if (category === "API Route" || category === "Page/Module") {
    reasonParts.push("Framework routes and module entry points may still execute without direct imports.");
  }

  const suggestedAction =
    category === "API Route"
      ? "Review whether this route is still exposed by the application and remove it if it is no longer needed."
      : category === "Page/Module"
      ? "Confirm whether this page or module is still reachable through navigation or route registration before removing it."
      : "Review this file and remove it if it is no longer required by the active codebase.";

  return {
    path: normalizedPath,
    category,
    confidence,
    incomingReferences,
    reason: reasonParts.join(" "),
    suggestedAction,
  };
};

const shouldConsider = (file: RepositoryFile, incomingReferences: number, category: DeadCodeCategory): boolean => {
  const filePath = normalizePath(file.path || "");
  if (!filePath) return false;
  if (isTestOrStoryFile(filePath)) return false;
  if (filePath.endsWith(".d.ts")) return false;

  if (incomingReferences === 0) {
    return true;
  }

  if (incomingReferences === 1 && isLegacyPath(filePath)) {
    return true;
  }

  if (incomingReferences <= 2 && category !== "Page/Module" && category !== "API Route") {
    return true;
  }

  return false;
};

export const buildDeadCodeReport = (files: RepositoryFile[]): DeadCodeReport => {
  const graph = buildDependencyGraph(files);
  const findings: DeadCodeFinding[] = [];

  graph.fileMap.forEach((file, normalizedPath) => {
    const incomingReferences = graph.dependentsMap.get(normalizedPath)?.length || 0;
    const category = determineCategory(normalizedPath);
    if (!shouldConsider(file, incomingReferences, category)) {
      return;
    }

    findings.push(buildFinding(file, incomingReferences, category));
  });

  const sorted = findings
    .sort((a, b) => b.confidence - a.confidence || a.incomingReferences - b.incomingReferences)
    .slice(0, 12);

  return {
    findings: sorted,
    totalCandidates: sorted.length,
    summary:
      sorted.length > 0
        ? `Detected ${sorted.length} high-priority dead code candidates from the repository dependency graph.`
        : "No high-confidence dead code candidates were detected.",
    repositoryFiles: files.length,
  };
};
