import { IssueAnalysisResult, IssueData, RepositoryMetadata } from "@/types/firstPRSimulator";

const normalizeText = (text = "") =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractKeywords = (input: string) => {
  const normalized = normalizeText(input);
  const tokens = normalized.split(" ").filter(Boolean);
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "from",
    "into",
    "using",
    "issue",
    "bug",
    "add",
    "new",
    "update",
    "fix",
    "support",
    "improve",
    "use",
    "remove",
    "code",
    "application",
    "feature",
    "change",
    "refactor",
    "performance",
  ]);

  return Array.from(new Set(tokens.filter((token) => token.length > 2 && !stopWords.has(token))));
};

const inferAffectedAreas = (keywords: string[], labels: IssueData["labels"] = []) => {
  const areas = new Set<string>();

  const labelMap: Record<string, string> = {
    bug: "Bug Fix",
    security: "Security",
    performance: "Performance",
    ui: "User Interface",
    ux: "User Interface",
    api: "API",
    backend: "Backend",
    frontend: "Frontend",
    docs: "Documentation",
    refactor: "Refactor",
    maintenance: "Maintenance",
    tests: "Test Coverage",
  };

  labels.forEach((label) => {
    const key = label.name.toLowerCase();
    if (labelMap[key]) {
      areas.add(labelMap[key]);
    }
  });

  const mapping: Record<string, string> = {
    auth: "Authentication",
    login: "Authentication",
    logout: "Authentication",
    session: "Session Management",
    middleware: "Middleware",
    graph: "Dependency Graph",
    api: "API Services",
    endpoint: "API Services",
    ui: "User Interface",
    button: "User Interface",
    page: "User Interface",
    dashboard: "Dashboard",
    repo: "Repository Management",
    repository: "Repository Management",
    search: "Search",
    settings: "Settings",
    webhook: "Webhooks",
    analytics: "Analytics",
    performance: "Performance",
    test: "Test Coverage",
    bug: "Bug Fix",
    refactor: "Refactor",
    schema: "Database",
    prisma: "Database",
  };

  keywords.forEach((keyword) => {
    if (mapping[keyword]) {
      areas.add(mapping[keyword]);
    }
  });

  if (areas.size === 0) {
    areas.add("Core Application");
  }

  return Array.from(areas).slice(0, 4);
};

const inferLikelyModules = (keywords: string[], metadata?: RepositoryMetadata) => {
  const modules = new Set<string>();
  const repositoryHints = new Set<string>();

  metadata?.languages?.forEach((language) => {
    repositoryHints.add(language.name.toLowerCase());
  });

  keywords.forEach((keyword) => {
    if (keyword.includes("auth")) {
      modules.add("Authentication");
    }
    if (keyword.includes("api")) {
      modules.add("API Services");
    }
    if (keyword.includes("ui") || keyword.includes("dashboard") || keyword.includes("page")) {
      modules.add("User Interface");
    }
    if (keyword.includes("repo") || keyword.includes("repository")) {
      modules.add("Repository Management");
    }
    if (keyword.includes("test") || keyword.includes("coverage")) {
      modules.add("Test Coverage");
    }
    if (keyword.includes("perf") || keyword.includes("performance")) {
      modules.add("Performance");
    }
    if (keyword.includes("webhook") || keyword.includes("integration")) {
      modules.add("Integrations");
    }
  });

  repositoryHints.forEach((hint) => {
    if (hint.includes("typescript") || hint.includes("javascript")) {
      modules.add("Frontend / Web");
    }
    if (hint.includes("prisma") || hint.includes("sql") || hint.includes("postgres")) {
      modules.add("Database");
    }
  });

  if (modules.size === 0) {
    modules.add("Shared Logic");
  }

  return Array.from(modules).slice(0, 4);
};

export function analyzeIssue(issue: IssueData, repository?: RepositoryMetadata): IssueAnalysisResult {
  const titleKeywords = extractKeywords(issue.title || "");
  const bodyKeywords = extractKeywords(issue.body || "");
  const labelKeywords = (issue.labels || []).flatMap((label) => extractKeywords(label.name || ""));
  const keywords = Array.from(new Set([...titleKeywords, ...bodyKeywords, ...labelKeywords]));

  const affectedAreas = inferAffectedAreas(keywords, issue.labels);
  const likelyModules = inferLikelyModules(keywords, repository);

  const confidence = Math.min(
    100,
    30 + keywords.length * 10 + affectedAreas.length * 5 + likelyModules.length * 5,
  );

  const summary = `Predicting a ${affectedAreas[0] || "core"} change based on issue text and labels.`;

  return {
    keywords,
    affectedAreas,
    likelyModules,
    confidence,
    summary,
  };
}
