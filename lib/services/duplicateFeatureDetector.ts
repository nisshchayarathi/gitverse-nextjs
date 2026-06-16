import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

export type DuplicateCategory =
  | "validation"
  | "authentication"
  | "api"
  | "utility"
  | "error-handling"
  | "business"
  | "other";

export interface DuplicateFeature {
  id: string;
  featureName: string;
  confidence: number; // 0-100
  files: string[];
  recommendation: string;
  category: DuplicateCategory;
  examples: Array<{
    file: string;
    symbol: string;
    snippet?: string;
  }>;
}

interface FunctionSummary {
  name: string;
  paramsCount: number;
  serialized: string;
  tokens: string[];
  imports: string[];
  snippet: string;
}

interface FileSummary {
  file: string;
  functions: FunctionSummary[];
  raw: string;
}

interface AnalyzeOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  maxFiles?: number;
  maxFunctions?: number;
}

const MAX_FILES = 800;
const MAX_FUNCTIONS = 1200;
const MAX_COMPARISONS = 250_000;
const MIN_SIMILARITY_SCORE = 0.45;
const IGNORED_DIRECTORIES = new Set(["node_modules", ".git", "dist", "out"]);

async function readDirRecursive(
  root: string,
  exts = [".ts", ".tsx", ".js", ".jsx"],
  signal?: AbortSignal
) {
  const results: string[] = [];

  const walk = async (dir: string) => {
    if (signal?.aborted) throw new Error("Analysis aborted");
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (signal?.aborted) throw new Error("Analysis aborted");

      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) continue;
        await walk(full);
      } else if (entry.isFile()) {
        if (exts.includes(path.extname(entry.name))) {
          results.push(full);
        }
      }
    }
  }

  await walk(root);
  return results;
}

function getSourceFile(filePath: string, content: string) {
  return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
}

function normalizeIdentifierMapping() {
  let idx = 0;
  const map = new Map<string, string>();
  return (name: string) => {
    if (!map.has(name)) map.set(name, `id${++idx}`);
    return map.get(name)!;
  };
}

function serializeNode(node: ts.Node, idMapper: (n: string) => string, signal?: AbortSignal): string {
  const parts: string[] = [];

  function visit(n: ts.Node) {
    if (signal?.aborted) throw new Error("Analysis aborted");
    parts.push(ts.SyntaxKind[n.kind]);

    if (ts.isIdentifier(n)) {
      parts.push(`:${idMapper(n.text)}`);
    } else if (ts.isStringLiteral(n) || ts.isNumericLiteral(n)) {
      parts.push(`:${n.getText()}`);
    }

    n.forEachChild(visit);
  }

  visit(node);
  return parts.join("|");
}

function tokenizeNormalized(str: string) {
  return Array.from(new Set(str.split(/\W+/).filter(Boolean)));
}

function jaccard(a: string[], b: string[]) {
  const sa = new Set(a);
  const sb = new Set(b);
  const inter = new Set(Array.from(sa).filter((x) => sb.has(x)));
  const union = new Set(Array.from(sa).concat(Array.from(sb)));
  if (union.size === 0) return 0;
  return inter.size / union.size;
}

function guessCategory(name: string, filePath: string, content: string): DuplicateCategory {
  const key = (name + " " + filePath + " " + content).toLowerCase();
  if (/validate|schema|is.*valid|zod|yup|joi|validator/.test(key)) return "validation";
  if (/auth|login|logout|session|token|jwt|passport/.test(key)) return "authentication";
  if (/fetch\(|axios|request|fetch\b|http\b|api\b/.test(key)) return "api";
  if (/(util|helper|helpers|utils)\b/.test(key) || /map|reduce|cloneDeep/.test(key)) return "utility";
  if (/try\s*\{|catch\s*\(|throw\s+new\s+Error|error\.status/.test(key)) return "error-handling";
  if (/invoice|purchase|order|subscription|billing|repository|commit|pull request|pr\b/.test(key)) return "business";
  return "other";
}

function createStableFeatureId(featureName: string, files: string[], category: DuplicateCategory) {
  return `${featureName}:${category}:${files.join("|")}`;
}

export async function analyzeRepository(rootDir: string, options: AnalyzeOptions = {}): Promise<DuplicateFeature[]> {
  if (options.signal?.aborted) throw new Error("Analysis aborted");

  let files = await readDirRecursive(rootDir, [".ts", ".tsx", ".js", ".jsx"], options.signal);
  if (files.length > (options.maxFiles ?? MAX_FILES)) {
    files = files.slice(0, options.maxFiles ?? MAX_FILES);
  }

  const summaries: FileSummary[] = [];

  for (const filePath of files) {
    if (options.signal?.aborted) throw new Error("Analysis aborted");

    try {
      const raw = await fs.promises.readFile(filePath, "utf8");
      const sourceFile = getSourceFile(filePath, raw);
      const imports: string[] = [];

      sourceFile.forEachChild((node) => {
        if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
          imports.push(node.moduleSpecifier.getText().replace(/['\"]/g, ""));
        }
      });

      const functions: FunctionSummary[] = [];

      function captureFunction(name: string, node: ts.Node, paramsCount: number) {
        if (options.signal?.aborted) throw new Error("Analysis aborted");
        const idMapper = normalizeIdentifierMapping();
        const serialized = serializeNode(node, idMapper, options.signal);
        const tokens = tokenizeNormalized(serialized);
        const snippet = node.getText().slice(0, 800);
        functions.push({ name, paramsCount, serialized, tokens, imports, snippet });
      }

      function walk(node: ts.Node) {
        if (options.signal?.aborted) throw new Error("Analysis aborted");

        if (ts.isFunctionDeclaration(node) && node.body) {
          captureFunction(node.name?.text || "<anonymous>", node, node.parameters.length);
        } else if (ts.isVariableStatement(node)) {
          node.declarationList.declarations.forEach((declaration) => {
            if (
              declaration.initializer &&
              (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
            ) {
              const name = ts.isIdentifier(declaration.name) ? declaration.name.text : "<anonymous>";
              captureFunction(name, declaration.initializer, declaration.initializer.parameters.length);
            }
          });
        } else if (ts.isClassDeclaration(node)) {
          node.members.forEach((member) => {
            if (ts.isMethodDeclaration(member) && member.body) {
              const name = ts.isIdentifier(member.name) ? member.name.text : "<method>";
              captureFunction(name, member, member.parameters.length);
            }
          });
        }

        node.forEachChild(walk);
      }

      walk(sourceFile);
      if (functions.length > 0) {
        summaries.push({ file: path.relative(rootDir, filePath), functions, raw });
      }
    } catch {
      // ignore unreadable or unsupported files
    }
  }

  type Candidate = { file: string; fn: FunctionSummary };
  const allFunctions: Candidate[] = [];

  for (const summary of summaries) {
    for (const fn of summary.functions) {
      if (options.signal?.aborted) throw new Error("Analysis aborted");
      allFunctions.push({ file: summary.file, fn });
    }
  }

  if (allFunctions.length > (options.maxFunctions ?? MAX_FUNCTIONS)) {
    allFunctions.splice(options.maxFunctions ?? MAX_FUNCTIONS);
  }

  const clusters: Array<{ members: Candidate[]; score: number }> = [];
  let comparisonCount = 0;

  outer: for (let i = 0; i < allFunctions.length; i++) {
    if (options.signal?.aborted) throw new Error("Analysis aborted");

    const a = allFunctions[i];
    for (let j = i + 1; j < allFunctions.length; j++) {
      if (options.signal?.aborted) throw new Error("Analysis aborted");
      comparisonCount += 1;
      if (comparisonCount > (options.maxFunctions ? options.maxFunctions * 200 : MAX_COMPARISONS)) {
        break outer;
      }

      const b = allFunctions[j];
      if (a.file === b.file && a.fn.name === b.fn.name) continue;

      const sigSim =
        a.fn.paramsCount === b.fn.paramsCount
          ? 1
          : 1 - Math.abs(a.fn.paramsCount - b.fn.paramsCount) / Math.max(a.fn.paramsCount, b.fn.paramsCount, 1);
      const structSim = jaccard(a.fn.tokens, b.fn.tokens);
      const depSim = jaccard(a.fn.imports || [], b.fn.imports || []);

      const condCountA = (a.fn.serialized.match(/IfStatement/g) || []).length;
      const condCountB = (b.fn.serialized.match(/IfStatement/g) || []).length;
      const condSim =
        condCountA === condCountB
          ? 1
          : 1 - Math.abs(condCountA - condCountB) / Math.max(condCountA, condCountB, 1);

      const combined = structSim * 0.55 + sigSim * 0.2 + condSim * 0.15 + depSim * 0.1;
      if (combined <= MIN_SIMILARITY_SCORE) continue;

      let found = clusters.find(
        (cluster) =>
          cluster.members.some((member) => member === a) ||
          cluster.members.some((member) => member === b)
      );

      if (!found) {
        found = { members: [a, b], score: combined };
        clusters.push(found);
      } else {
        if (!found.members.includes(a)) found.members.push(a);
        if (!found.members.includes(b)) found.members.push(b);
        found.score = Math.max(found.score, combined);
      }
    }
  }

  const features: DuplicateFeature[] = clusters.map((cluster) => {
    const files = Array.from(new Set(cluster.members.map((member) => member.file)));
    const names = Array.from(new Set(cluster.members.map((member) => member.fn.name)));
    const example = cluster.members[0];
    const combinedText = `${names.join(" ")} ${files.join(" ")} ${example?.fn.snippet || ""}`;
    const category = guessCategory(names.join(" "), files.join(" "), combinedText);
    const featureName = names.find((name) => name && name !== "<anonymous>") || files.join("/");
    const confidence = Math.min(100, Math.round((cluster.score || 0) * 100));
    const recommendation = (() => {
      switch (category) {
        case "validation":
          return "Extract shared validator utility";
        case "authentication":
          return "Unify authentication flow into a single service";
        case "api":
          return "Centralize API request helpers / clients";
        case "utility":
          return "Move shared helpers into a utils module";
        case "error-handling":
          return "Standardize error handling and create shared helpers";
        case "business":
          return "Consolidate business rules into a single domain service";
        default:
          return "Review and consider extracting shared logic";
      }
    })();

    return {
      id: createStableFeatureId(featureName || "duplicate-feature", files, category),
      featureName: featureName || "Duplicate Feature",
      confidence,
      files,
      recommendation,
      category,
      examples: cluster.members.slice(0, 5).map((member) => ({ file: member.file, symbol: member.fn.name, snippet: member.fn.snippet })),
    };
  });

  features.sort((a, b) => b.confidence - a.confidence);
  return features;
}

export default { analyzeRepository };
