import {
  FilePrediction,
  IssueAnalysisResult,
  RepositoryFile,
  RepositoryMetadata,
} from "@/types/firstPRSimulator";

const normalizePath = (path: string) => path.toLowerCase().replace(/\\/g, "/");

const splitPathSegments = (path: string) =>
  normalizePath(path)
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/\.[a-z0-9]+$/, ""));

const scoreFileWithKeywords = (file: RepositoryFile, keywords: string[]) => {
  const pathText = normalizePath(file.path);
  const fileName = file.name || file.path.split("/").pop() || "";
  let score = 0;

  keywords.forEach((keyword) => {
    if (pathText.includes(keyword)) {
      score += 12;
    }
    if (fileName.toLowerCase().includes(keyword)) {
      score += 10;
    }
    if (pathText.endsWith(`/${keyword}`) || pathText.includes(`/${keyword}/`)) {
      score += 6;
    }
    if (file.content && file.content.toLowerCase().includes(keyword)) {
      score += 8;
    }
  });

  return score;
};

const scoreModuleMatches = (file: RepositoryFile, modules: string[]) => {
  const pathText = normalizePath(file.path);
  let score = 0;

  modules.forEach((module) => {
    const normalizedModule = module.toLowerCase().replace(/\s+/g, "");
    if (pathText.includes(normalizedModule)) {
      score += 8;
    }
    if (pathText.includes(normalizedModule.slice(0, 4))) {
      score += 3;
    }
  });

  return score;
};

const parseImportsFromContent = (content?: string) => {
  if (!content) {
    return [];
  }

  const importMatches = Array.from(content.matchAll(/import\s+(?:.*?from\s+)?["'](.+?)["']/gi));
  return importMatches.map((match) => match[1]);
};

const resolveImportPath = (source: string, originPath: string, filePaths: Set<string>) => {
  const normalizedSource = source.replace(/\.[jt]sx?$/, "");
  if (normalizedSource.startsWith("./") || normalizedSource.startsWith("../")) {
    const originParts = originPath.split("/").slice(0, -1);
    const sourceParts = normalizedSource.split("/");
    const resolvedParts: string[] = [];

    originParts.forEach((part) => resolvedParts.push(part));
    sourceParts.forEach((part) => {
      if (part === ".") return;
      if (part === "..") {
        resolvedParts.pop();
      } else {
        resolvedParts.push(part);
      }
    });

    const candidate = `${resolvedParts.join("/")}.ts`;
    if (filePaths.has(candidate)) {
      return candidate;
    }
    const candidateJs = `${resolvedParts.join("/")}.tsx`;
    if (filePaths.has(candidateJs)) {
      return candidateJs;
    }
    return `${resolvedParts.join("/")}`;
  }

  return source;
};

export const buildRepositoryGraph = (files: RepositoryFile[]) => {
  const filePaths = new Set(files.map((file) => normalizePath(file.path)));
  const graph = new Map<string, Set<string>>();

  files.forEach((file) => {
    const originPath = normalizePath(file.path);
    const imports = file.imports || parseImportsFromContent(file.content);
    const resolvedImports = imports
      .map((source) => resolveImportPath(source, originPath, filePaths))
      .filter(Boolean)
      .map((source) => normalizePath(source));

    graph.set(originPath, new Set(resolvedImports.filter((path) => filePaths.has(path))));
  });

  return graph;
};

const scoreByDirectoryDepth = (file: RepositoryFile) => {
  const depth = splitPathSegments(file.path).length;
  return Math.min(depth, 6) * 2;
};

export const predictFiles = (
  issueAnalysis: IssueAnalysisResult,
  files: RepositoryFile[] = [],
  repository?: RepositoryMetadata,
): FilePrediction[] => {
  if (!files.length) {
    return [];
  }

  const graph = buildRepositoryGraph(files);
  const filePaths = new Set(files.map((file) => normalizePath(file.path)));

  const predicted = files.map((file) => {
    const keywordScore = scoreFileWithKeywords(file, issueAnalysis.keywords);
    const moduleScore = scoreModuleMatches(file, issueAnalysis.likelyModules);
    const depthScore = scoreByDirectoryDepth(file);
    const importScore = graph.get(normalizePath(file.path))?.size ?? 0;
    const fileSizeScore = Math.min((file.lines ?? file.size ?? 0) / 100, 8);

    let totalScore = keywordScore + moduleScore + depthScore + importScore + fileSizeScore;

    if (issueAnalysis.affectedAreas.some((area) => normalizePath(area).includes("api")) && file.path.match(/api\//i)) {
      totalScore += 12;
    }
    if (issueAnalysis.affectedAreas.some((area) => normalizePath(area).includes("ui")) && file.path.match(/components\//i)) {
      totalScore += 10;
    }
    if (repository?.languages?.some((lang) => lang.name.toLowerCase().includes("typescript"))) {
      totalScore += 2;
    }

    const reasonParts = [];
    if (keywordScore > 0) {
      reasonParts.push("matches issue keywords");
    }
    if (moduleScore > 0) {
      reasonParts.push("aligns with target module");
    }
    if (importScore > 0) {
      reasonParts.push("has a dependency footprint");
    }
    if (!reasonParts.length) {
      reasonParts.push("likely related by path and repository structure");
    }

    return {
      path: file.path,
      confidence: Math.min(100, Math.max(0, Math.round(totalScore * 2.25))),
      reason: reasonParts.join(" and "),
    };
  });

  return predicted
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8)
    .map((prediction, index) => ({
      ...prediction,
      confidence: Math.max(prediction.confidence - index * 3, 10),
    }));
};
