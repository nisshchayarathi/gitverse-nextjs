"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePullRequestUrl = parsePullRequestUrl;
exports.reviewPullRequest = reviewPullRequest;
exports.formatPRReviewMarkdown = formatPRReviewMarkdown;
const githubService_1 = require("@/lib/services/githubService");
const geminiService_1 = require("@/lib/services/geminiService");
function clampScore(score) {
    const n = typeof score === "number" ? score : Number(score);
    if (!Number.isFinite(n))
        return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
}
function isValidSeverity(value) {
    return (value === "critical" ||
        value === "high" ||
        value === "medium" ||
        value === "low");
}
function isValidCategory(value) {
    return (value === "security" ||
        value === "correctness" ||
        value === "performance" ||
        value === "maintainability" ||
        value === "style" ||
        value === "testing" ||
        value === "documentation");
}
function safeParseReviewJson(text) {
    if (!text?.trim())
        return null;
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace)
        return null;
    const jsonSlice = text.slice(firstBrace, lastBrace + 1);
    let parsed;
    try {
        parsed = JSON.parse(jsonSlice);
    }
    catch {
        return null;
    }
    const summary = typeof parsed?.summary === "string" ? parsed.summary : "";
    const overallScore = clampScore(parsed?.overallScore);
    const praise = Array.isArray(parsed?.praise)
        ? parsed.praise.filter((p) => typeof p === "string").slice(0, 10)
        : [];
    const issuesRaw = Array.isArray(parsed?.issues) ? parsed.issues : [];
    const issues = issuesRaw
        .map((i) => {
        const title = typeof i?.title === "string" ? i.title : "";
        const severity = isValidSeverity(i?.severity)
            ? i.severity
            : "low";
        const category = isValidCategory(i?.category)
            ? i.category
            : "maintainability";
        const file = typeof i?.file === "string" ? i.file : null;
        const line = Number.isFinite(Number(i?.line)) ? Number(i.line) : null;
        const explanation = typeof i?.explanation === "string" ? i.explanation : "";
        const suggestion = typeof i?.suggestion === "string" ? i.suggestion : "";
        if (!title || !explanation || !suggestion)
            return null;
        return { title, severity, category, file, line, explanation, suggestion };
    })
        .filter(Boolean)
        .slice(0, 50);
    if (!summary)
        return null;
    return { summary, overallScore, issues, praise };
}
function shouldIgnoreFile(filename) {
    const lower = filename.toLowerCase();
    if (lower.includes("package-lock.json") ||
        lower.includes("yarn.lock") ||
        lower.includes("pnpm-lock.yaml") ||
        lower.includes("bun.lockb")) {
        return true;
    }
    if (lower.startsWith("dist/") ||
        lower.startsWith("build/") ||
        lower.startsWith("out/") ||
        lower.includes("/.next/") ||
        lower.includes("node_modules/") ||
        lower.includes("vendor/")) {
        return true;
    }
    if (lower.endsWith(".min.js") ||
        lower.endsWith(".min.css") ||
        lower.endsWith(".svg") ||
        lower.endsWith(".png") ||
        lower.endsWith(".jpg") ||
        lower.endsWith(".csv") ||
        lower.endsWith(".pdf") ||
        lower.endsWith(".map")) {
        return true;
    }
    return false;
}
function buildDiffForPrompt(files) {
    const maxFiles = 25;
    const maxChars = 60_000;
    const maxPatchCharsPerFile = 4_000;
    const validFiles = files.filter((f) => !shouldIgnoreFile(f.filename));
    const selected = validFiles.slice(0, maxFiles);
    const stats = files
        .map((f) => `- ${f.filename} (${f.status}) +${f.additions}/-${f.deletions} (~${f.changes})`)
        .join("\n");
    let diff = "";
    for (const f of selected) {
        if (!f.patch)
            continue;
        const patch = f.patch.length > maxPatchCharsPerFile
            ? f.patch.slice(0, maxPatchCharsPerFile) + "\n... (truncated)"
            : f.patch;
        const block = `\n\n### ${f.filename}\n\n\`\`\`diff\n${patch}\n\`\`\`\n`;
        if (diff.length + block.length > maxChars)
            break;
        diff += block;
    }
    return { diff: diff.trim(), stats };
}
function parsePullRequestUrl(url) {
    if (!url)
        return null;
    const match = url
        .trim()
        .match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)(?:\/.*)?$/i);
    if (!match)
        return null;
    const owner = match[1];
    const repo = match[2].replace(/\.git$/i, "");
    const number = Number(match[3]);
    if (!owner || !repo || !Number.isFinite(number))
        return null;
    return { owner, repo, number };
}
async function reviewPullRequest(params) {
    const github = new githubService_1.GitHubService(params.githubToken);
    const pr = await github.getPullRequest(params.owner, params.repo, params.number);
    const prFiles = await github.getPullRequestFiles(params.owner, params.repo, params.number);
    const { diff, stats } = buildDiffForPrompt(prFiles.map((f) => ({
        filename: f.filename,
        status: f.status,
        patch: f.patch,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
    })));
    const { crossRepoImpactService } = await Promise.resolve().then(() => __importStar(require("./cross-repo-impact")));
    const modifiedFileNames = prFiles.map(f => f.filename);
    const impactReport = crossRepoImpactService.analyzeImpact(`${params.owner}/${params.repo}`, modifiedFileNames);
    const impactContext = impactReport.potentiallyAffectedRepositories.length > 0
        ? `\nCross-Repository Impact Risk: ${impactReport.risk}\nReason: ${impactReport.reason}\nPotentially Affected Downstream Repositories: ${impactReport.potentiallyAffectedRepositories.join(", ")}\n`
        : "";
    if (!diff) {
        throw new Error("PR diff is unavailable (no patch content returned). GitHub may omit patch content for very large changes.");
    }
    const prompt = `You are a senior code reviewer. Review the following GitHub Pull Request changes.

Return ONLY valid JSON matching this schema (no markdown, no code fences, no extra text):
{
  "summary": string,
  "overallScore": number, // 0-100 (higher is better)
  "issues": Array<{
    "title": string,
    "severity": "critical"|"high"|"medium"|"low",
    "category": "security"|"correctness"|"performance"|"maintainability"|"style"|"testing"|"documentation",
    "file": string|null,
    "line": number|null,
    "explanation": string,
    "suggestion": string
  }>,
  "praise": string[]
}

Guidance:
- Prefer fewer, higher-signal issues; max 20 issues.
- If you reference a line, approximate based on the diff hunk; otherwise use null.
- Focus on security, correctness, complexity spikes, and maintainability.

Scoring rubric (0-100):
- 90-100: Excellent, low-risk, well-tested and well-scoped.
- 60-89: Solid change with minor issues.
- 30-59: Concerning; needs meaningful revisions.
- 1-29: Very poor quality, risky, or not meeting requirements.
- 0: Unacceptable / effectively a bad PR (spam, irrelevant changes, vandalism, or clearly harmful).

IMPORTANT:
- It is OK to give an overallScore of 0.
- If the change is irrelevant to the repo goal (e.g., README changed to unrelated content), treat it as unacceptable: set overallScore to 0-10, include at least one HIGH/CRITICAL issue explaining why, and make the summary a clear warning.
- Do NOT invent praise. If there are no genuine positives, return an empty "praise" array. For low-quality PRs (overallScore < 40), prefer an empty "praise" array.

PR Title: ${pr.title}
PR Author: ${pr.user?.login || "unknown"}
Base: ${pr.base?.ref || "?"}  Head: ${pr.head?.ref || "?"}
Changed files (subset):\n${stats}
${impactContext}
Diff (subset, may be truncated):\n${diff}
`;
    let raw;
    let tokensConsumed = 0;
    try {
        const gemini = new geminiService_1.GeminiService();
        const result = await gemini.chatRaw(prompt);
        raw = result.text;
        tokensConsumed = result.tokensConsumed;
    }
    catch (error) {
        console.error("[reviewPullRequest] Gemini API Error:", error?.message || error);
        // Graceful fallback for payload too large or timeouts
        return {
            review: {
                summary: "The pull request diff was too large or complex for the AI to analyze fully, or the AI service timed out. Please review the changes manually.",
                overallScore: 50,
                issues: [{
                        title: "PR Diff Too Large / Analysis Timeout",
                        severity: "medium",
                        category: "maintainability",
                        file: null,
                        line: null,
                        explanation: "The AI service encountered an error processing the size or complexity of this PR.",
                        suggestion: "Consider breaking this PR into smaller, more focused changes, or rely on manual code review."
                    }],
                praise: []
            },
            prTitle: pr.title,
            prUrl: pr.html_url
        };
    }
    const parsed = safeParseReviewJson(raw);
    if (!parsed) {
        throw new Error("AI response was not valid JSON");
    }
    return { review: parsed, prTitle: pr.title, prUrl: pr.html_url, tokensConsumed };
}
function formatPRReviewMarkdown(params) {
    const { review, prUrl } = params;
    const score = Math.max(0, Math.min(100, Math.round(review.overallScore || 0)));
    const bySeverity = {
        critical: [],
        high: [],
        medium: [],
        low: [],
    };
    for (const issue of review.issues || []) {
        bySeverity[issue.severity]?.push(issue);
    }
    const lines = [];
    lines.push("## GitVerse PR Review");
    if (prUrl)
        lines.push(`PR: ${prUrl}`);
    lines.push("");
    lines.push(`**Overall score:** ${score}/100`);
    const hasCritical = (review.issues || []).some((i) => i.severity === "critical");
    if (score <= 10 || hasCritical) {
        lines.push("");
        lines.push("### Warning");
        if (score === 0) {
            lines.push("This PR looks unacceptable as-is (score 0). Consider closing it or requesting a complete rewrite.");
        }
        else {
            lines.push("This PR looks high-risk or low-quality. Address the critical/high issues before merging.");
        }
    }
    lines.push("");
    lines.push("### Summary");
    lines.push(review.summary || "(no summary)");
    // Avoid forced positivity: only show praise when the overall PR quality is decent.
    if (score >= 50 && (review.praise || []).length) {
        lines.push("");
        lines.push("### What’s good");
        for (const p of review.praise.slice(0, 5)) {
            lines.push(`- ${p}`);
        }
    }
    lines.push("");
    lines.push("### Issues");
    const severities = ["critical", "high", "medium", "low"];
    const hasAny = severities.some((s) => bySeverity[s].length);
    if (!hasAny) {
        lines.push("- No issues flagged.");
        return lines.join("\n");
    }
    for (const sev of severities) {
        const issues = bySeverity[sev];
        if (!issues.length)
            continue;
        lines.push("");
        lines.push(`#### ${sev.toUpperCase()} (${issues.length})`);
        for (const issue of issues.slice(0, 10)) {
            const loc = issue.file
                ? `${issue.file}${issue.line != null ? `:${issue.line}` : ""}`
                : "";
            lines.push(`- **${issue.title}**${loc ? ` (${loc})` : ""}`);
            lines.push(`  - Category: ${issue.category}`);
            lines.push(`  - Why: ${issue.explanation}`);
            lines.push(`  - Suggestion: ${issue.suggestion}`);
        }
    }
    lines.push("");
    lines.push("_Generated by GitVerse_");
    return lines.join("\n");
}
