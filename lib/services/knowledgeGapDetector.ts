import fs from "fs";
import path from "path";

export type RiskLevel = "Low" | "Medium" | "High";

export interface FileGap {
  filePath: string;
  importsCount: number;
  dependentsCount: number;
  lines: number;
  commentLines: number;
  commentRatio: number; // 0..1
  hasTopLevelDoc: boolean;
  knowledgeGapScore: number; // 0..100 (higher -> larger gap)
  riskLevel: RiskLevel;
  suggestions: string[];
}

async function walkDir(root: string, dir: string, files: string[]) {
  const entries = await fs.promises.readdir(path.join(root, dir), { withFileTypes: true });
  for (const ent of entries) {
    const rel = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      // skip node_modules, .git, dist, public
      if (ent.name === "node_modules" || ent.name === ".git" || ent.name === "dist" || ent.name === "public") continue;
      await walkDir(root, rel, files);
    } else if (ent.isFile()) {
      if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(ent.name)) {
        files.push(rel.replace(/\\/g, "/"));
      }
    }
  }
}



function countCommentLines(content: string) {
  const lines = content.split(/\r?\n/);
  let commentLines = 0;
  let inBlock = false;
  for (const line of lines) {
    const t = line.trim();
    if (inBlock) {
      commentLines++;
      if (t.includes("*/")) inBlock = false;
      continue;
    }
    if (t.startsWith("//")) {
      commentLines++;
      continue;
    }
    if (t.startsWith("/*") || t.startsWith("/**")) {
      commentLines++;
      if (!t.includes("*/")) inBlock = true;
      continue;
    }
  }
  return { total: lines.length, commentLines };
}

function hasTopLevelDoc(content: string) {
  // Detect a leading JSDoc block with at least 3 lines
  const m = content.match(/^\s*\/\*\*[\s\S]{10,}?\*\//);
  return !!m;
}

export async function analyzeRepository(rootDir: string): Promise<FileGap[]> {
  const start = process.cwd();
  const repoRoot = path.resolve(rootDir || start);
  const files: string[] = [];
  await walkDir(repoRoot, ".", files);

  const fileContents: Record<string, string> = {};
  for (const f of files) {
    try {
      fileContents[f] = await fs.promises.readFile(path.join(repoRoot, f), "utf8");
    } catch (e) {
      fileContents[f] = "";
    }
  }

  // Build simple import map: file -> importedFilePaths (by naive filename match)
  const importMap: Record<string, Set<string>> = {};
  const basenameIndex: Record<string, string[]> = {};
  for (const f of files) {
    const bn = path.basename(f).replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/i, "");
    basenameIndex[bn] = basenameIndex[bn] || [];
    basenameIndex[bn].push(f);
  }

  for (const f of files) {
    const content = fileContents[f] || "";
    const imports: Set<string> = new Set();
    const importRegex = /from\s+["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = importRegex.exec(content))) {
      const spec = m[1] || m[2];
      if (!spec) continue;
      // try to resolve local files (starts with ./ or ../) or bare names that match basenames
      if (spec.startsWith("./") || spec.startsWith("../")) {
        const resolved = path.normalize(path.join(path.dirname(f), spec));
        const candidates = [resolved, resolved + ".ts", resolved + ".tsx", resolved + ".js", resolved + ".jsx"];
        for (const c of candidates) {
          const pref = c.replace(/\\/g, "/").replace(/^[.]/, "");
          const trimmed = pref.startsWith("/") ? pref.slice(1) : pref;
          if (fileContents[trimmed]) {
            imports.add(trimmed);
            break;
          }
        }
      } else {
        const name = path.basename(spec).replace(/\.(ts|tsx|js|jsx)$/i, "");
        const matches = basenameIndex[name] || [];
        for (const cand of matches) imports.add(cand);
      }
    }
    importMap[f] = imports;
  }

  // compute dependents count
  const dependentsCount: Record<string, number> = {};
  for (const f of files) dependentsCount[f] = 0;
  for (const [, set] of Object.entries(importMap)) {
    for (const t of set) {
      if (dependentsCount[t] !== undefined) dependentsCount[t]++;
    }
  }

  const results: FileGap[] = [];
  for (const f of files) {
    const content = fileContents[f] || "";
    const importsCount = importMap[f] ? importMap[f].size : 0;
    const depCount = dependentsCount[f] || 0;
    const { total, commentLines } = countCommentLines(content);
    const cRatio = total > 0 ? commentLines / total : 0;
    const topDoc = hasTopLevelDoc(content);

    // Score calculation
    // importance reduces gap: more dependents/imports -> lower gap
    const importance = Math.min(1, (depCount * 2 + importsCount) / 10); // 0..1
    const commentPenalty = 1 - cRatio; // 0..1
    const missingDocsPenalty = topDoc ? 0 : 0.25;

    let score = 50; // base
    score -= importance * 30;
    score += commentPenalty * 30;
    score += missingDocsPenalty * 30;
    score = Math.max(0, Math.min(100, Math.round(score)));

    let risk: RiskLevel = "Low";
    if (score >= 70) risk = "High";
    else if (score >= 40) risk = "Medium";

    const suggestions: string[] = [];
    if (!topDoc) suggestions.push("Add a top-level JSDoc summary for the file explaining purpose and exports.");
    if (cRatio < 0.05) suggestions.push("Add inline comments explaining complex logic and function responsibilities.");
    if (depCount > 3) suggestions.push("Add high-level module documentation and diagrams showing relationships.");
    if (importsCount > 5) suggestions.push("Break large modules into smaller units or add README.md in the folder.");

    results.push({
      filePath: f,
      importsCount,
      dependentsCount: depCount,
      lines: total,
      commentLines,
      commentRatio: cRatio,
      hasTopLevelDoc: topDoc,
      knowledgeGapScore: score,
      riskLevel: risk,
      suggestions,
    });
  }

  // sort by score desc
  results.sort((a, b) => b.knowledgeGapScore - a.knowledgeGapScore);
  return results;
}

export default { analyzeRepository };
