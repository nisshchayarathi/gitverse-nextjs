import fs from "fs";
import path from "path";
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

async function readDirRecursive(root: string, exts = [".ts", ".tsx", ".js", ".jsx"]) {
  const results: string[] = [];
  async function walk(dir: string) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === ".git" || e.name === "dist" || e.name === "out") continue;
        await walk(full);
      } else if (e.isFile()) {
        if (exts.includes(path.extname(e.name))) results.push(full);
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

function serializeNode(node: ts.Node, idMapper: (n: string) => string): string {
  // Build a compact structural string ignoring literal identifier names
  const parts: string[] = [];
  function visit(n: ts.Node) {
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
  // business heuristics: presence of domain nouns like invoice, checkout, purchase, subscription, repository, commit
  if (/invoice|purchase|order|subscription|billing|repository|commit|pull request|pr\b/.test(key)) return "business";
  return "other";
}

export async function analyzeRepository(rootDir: string): Promise<DuplicateFeature[]> {
  const files = await readDirRecursive(rootDir);
  const summaries: Array<{
    file: string;
    functions: Array<{
      name: string;
      paramsCount: number;
      serialized: string;
      tokens: string[];
      imports: string[];
      snippet: string;
    }>;
    raw: string;
  }> = [];

  for (const f of files) {
    try {
      const raw = await fs.promises.readFile(f, "utf8");
      const sf = getSourceFile(f, raw);
      const imports: string[] = [];
      sf.forEachChild((n) => {
        if (ts.isImportDeclaration(n) && n.moduleSpecifier) {
          const txt = n.moduleSpecifier.getText().replace(/['\"]/g, "");
          imports.push(txt);
        }
      });

      const functions: any[] = [];

      function captureFunction(name: string, node: ts.Node, paramsCount: number) {
        const idMapper = normalizeIdentifierMapping();
        const serialized = serializeNode(node, idMapper);
        const tokens = tokenizeNormalized(serialized);
        const snippet = node.getText().slice(0, 800);
        functions.push({ name, paramsCount, serialized, tokens, imports, snippet });
      }

      function walk(n: ts.Node) {
        if (ts.isFunctionDeclaration(n) && n.body) {
          captureFunction(n.name?.text || "<anonymous>", n, n.parameters.length);
        } else if (ts.isVariableStatement(n)) {
          n.declarationList.declarations.forEach((d) => {
            if (d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) {
              const nm = (d.name && ts.isIdentifier(d.name)) ? d.name.text : "<anonymous>";
              captureFunction(nm, d.initializer, d.initializer.parameters.length);
            }
          });
        } else if (ts.isClassDeclaration(n)) {
          n.members.forEach((m) => {
            if (ts.isMethodDeclaration(m) && m.body) {
              const nm = (m.name && ts.isIdentifier(m.name)) ? m.name.text : "<method>";
              captureFunction(nm, m, m.parameters.length);
            }
          });
        }
        n.forEachChild(walk);
      }

      walk(sf);

      if (functions.length > 0) summaries.push({ file: path.relative(rootDir, f), functions, raw });
    } catch (err) {
      // ignore unreadable files
    }
  }

  // Pairwise compare functions across files
  type Candidate = { file: string; fn: any };
  const allFunctions: Candidate[] = [];
  for (const s of summaries) {
    for (const fn of s.functions) allFunctions.push({ file: s.file, fn });
  }

  const clusters: Array<{ members: Candidate[]; score: number }> = [];

  for (let i = 0; i < allFunctions.length; i++) {
    const a = allFunctions[i];
    for (let j = i + 1; j < allFunctions.length; j++) {
      const b = allFunctions[j];
      // skip same file identical references
      if (a.file === b.file && a.fn.name === b.fn.name) continue;

      const sigSim = a.fn.paramsCount === b.fn.paramsCount ? 1 : 1 - Math.abs(a.fn.paramsCount - b.fn.paramsCount) / Math.max(a.fn.paramsCount, b.fn.paramsCount, 1);
      const structSim = jaccard(a.fn.tokens, b.fn.tokens);
      const depSim = jaccard(a.fn.imports || [], b.fn.imports || []);

      // small heuristic: conditional count similarity
      const condCountA = (a.fn.serialized.match(/IfStatement/g) || []).length;
      const condCountB = (b.fn.serialized.match(/IfStatement/g) || []).length;
      const condSim = condCountA === condCountB ? 1 : 1 - Math.abs(condCountA - condCountB) / Math.max(condCountA, condCountB, 1);

      const combined = structSim * 0.55 + sigSim * 0.2 + condSim * 0.15 + depSim * 0.1;

      if (combined > 0.45) {
        // find existing cluster with either member
        let found = clusters.find((c) => c.members.some((m) => m === a) || c.members.some((m) => m === b));
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
  }

  // Map clusters into DuplicateFeature
  const features: DuplicateFeature[] = clusters.map((c) => {
    const files = Array.from(new Set(c.members.map((m) => m.file)));
    const names = Array.from(new Set(c.members.map((m) => m.fn.name)));
    const example = c.members[0];
    const combinedText = names.join(" ") + " " + files.join(" ") + " " + (example?.fn?.snippet || "");
    const category = guessCategory(names.join(" "), files.join(" "), combinedText);
    const featureName = names.find((n) => n && n !== "<anonymous>") || files.join("/");

    const confidence = Math.min(100, Math.round((c.score || 0) * 100));
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
      featureName: featureName || "Duplicate Feature",
      confidence,
      files,
      recommendation,
      category,
      examples: c.members.slice(0, 5).map((m) => ({ file: m.file, symbol: m.fn.name, snippet: m.fn.snippet })),
    };
  });

  // Sort by confidence desc
  features.sort((a, b) => b.confidence - a.confidence);
  return features;
}

export default { analyzeRepository };
