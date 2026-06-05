import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, relative } from "path";

const ROOT = join(__dirname, "..");
const DIST_WORKER = join(ROOT, "dist-worker");
const GIT_IGNORE = join(ROOT, ".gitignore");

let exitCode = 0;

function fail(message: string) {
  console.error(`FAIL: ${message}`);
  exitCode = 1;
}

function ok(message: string) {
  console.log(`  OK: ${message}`);
}

console.log("Verifying dist-worker consistency...\n");

// Check 1: dist-worker/ is in .gitignore
if (!existsSync(GIT_IGNORE)) {
  fail(".gitignore not found");
} else {
  const gitignore = readFileSync(GIT_IGNORE, "utf-8");
  if (gitignore.includes("dist-worker/")) {
    ok("dist-worker/ is listed in .gitignore");
  } else {
    fail("dist-worker/ is NOT listed in .gitignore — add it");
  }
}

// Check 2: dist-worker/ is not tracked by git
try {
  execSync("git ls-files --error-unmatch dist-worker/", {
    cwd: ROOT,
    stdio: "pipe",
  });
  fail("dist-worker/ is still tracked by git — run git rm -r --cached dist-worker/");
} catch {
  ok("dist-worker/ is not tracked by git");
}

// Check 3: dist-worker/ directory exists (was built)
if (existsSync(DIST_WORKER)) {
  ok("dist-worker/ directory exists");
} else {
  fail("dist-worker/ directory does not exist — run npm run build:worker");
}

// Check 4: Verify key compiled files exist
const requiredArtifacts = [
  "scripts/analysisWorker.js",
  "scripts/workerServer.js",
  "lib/middleware.js",
  "lib/auth.js",
  "lib/prisma.js",
];

for (const artifact of requiredArtifacts) {
  const fullPath = join(DIST_WORKER, artifact);
  if (existsSync(fullPath)) {
    ok(`dist-worker/${artifact} exists`);
  } else {
    fail(`dist-worker/${artifact} is missing — run npm run build:worker`);
  }
}

// Check 5: No .ts files in dist-worker (compiled output should only have .js)
try {
  const tsFiles = execSync(
    `find dist-worker -name '*.ts' -type f 2>/dev/null`,
    { cwd: ROOT, encoding: "utf-8" },
  ).trim();
  if (tsFiles) {
    fail(`dist-worker/ contains TypeScript files: ${tsFiles}`);
  } else {
    ok("dist-worker/ contains no .ts files");
  }
} catch {
  ok("dist-worker/ contains no .ts files");
}

// Check 6: Verify no source map files in dist-worker
try {
  const mapFiles = execSync(
    `find dist-worker -name '*.js.map' -type f 2>/dev/null`,
    { cwd: ROOT, encoding: "utf-8" },
  ).trim();
  if (mapFiles) {
    fail(`dist-worker/ contains source map files: ${mapFiles}`);
  } else {
    ok("dist-worker/ contains no source map files");
  }
} catch {
  ok("dist-worker/ contains no source map files");
}

// Check 7: Verify the build scripts reference the correct paths
const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
const workerScript = packageJson.scripts?.worker || "";
if (workerScript.includes("dist-worker/")) {
  ok("npm run worker targets dist-worker/");
} else {
  fail("npm run worker does not reference dist-worker/");
}

const serverScript = packageJson.scripts?.["worker:server"] || "";
if (serverScript.includes("dist-worker/")) {
  ok("npm run worker:server targets dist-worker/");
} else {
  fail("npm run worker:server does not reference dist-worker/");
}

// Check 8: Verify preworker script is not silently skipping
const preworker = packageJson.scripts?.preworker || "";
if (preworker.includes("build:worker")) {
  ok("preworker runs build:worker");
} else {
  fail("preworker does not run build:worker");
}

const preworkerServer = packageJson.scripts?.["preworker:server"] || "";
if (preworkerServer.includes("build:worker")) {
  ok("preworker:server runs build:worker");
} else {
  fail("preworker:server does not run build:worker");
}

// Check 9: Verify tsconfig.worker.json exists and has correct outDir
const tsconfigPath = join(ROOT, "tsconfig.worker.json");
if (existsSync(tsconfigPath)) {
  const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf-8"));
  if (tsconfig.compilerOptions?.outDir === "dist-worker") {
    ok("tsconfig.worker.json outputs to dist-worker/");
  } else {
    fail("tsconfig.worker.json outDir is not dist-worker/");
  }
} else {
  fail("tsconfig.worker.json not found");
}

// Check 10: Verify docker-compatible build by checking first few lines of a compiled file
const sampleFile = join(DIST_WORKER, "lib/prisma.js");
if (existsSync(sampleFile)) {
  const content = readFileSync(sampleFile, "utf-8");
  if (content.includes("require(") || content.includes("__esModule")) {
    ok("Compiled output uses CommonJS module format");
  } else {
    fail("Compiled output does not appear to be CommonJS");
  }
}

console.log();

if (exitCode === 0) {
  console.log("All consistency checks passed.");
} else {
  console.error(`${exitCode} consistency check(s) failed.`);
}

process.exit(exitCode);
