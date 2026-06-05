import * as fs from "fs/promises";
import * as path from "path";

/**
 * Finds all directories matching simple wildcard globs like "packages/*" or "apps/*"
 */
async function resolveWorkspaceGlobs(baseDir: string, globs: string[]): Promise<string[]> {
  const packages = new Set<string>();

  for (const pattern of globs) {
    if (pattern.endsWith("/*")) {
      const parentDir = pattern.slice(0, -2);
      try {
        const fullParent = path.join(baseDir, parentDir);
        const entries = await fs.readdir(fullParent, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            packages.add(path.posix.join(parentDir, entry.name));
          }
        }
      } catch (err) {
        // Directory might not exist, ignore
      }
    } else {
      // Direct path (e.g., "core", "packages/utils")
      try {
        const fullPath = path.join(baseDir, pattern);
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          packages.add(pattern);
        }
      } catch (err) {
        // Path might not exist, ignore
      }
    }
  }

  return Array.from(packages);
}

export async function detectMonorepoPackages(repoTempDir: string): Promise<string[]> {
  const globs = new Set<string>();

  // 1. Check package.json for npm/yarn workspaces
  try {
    const pkgJsonPath = path.join(repoTempDir, "package.json");
    const pkgContent = await fs.readFile(pkgJsonPath, "utf8");
    const pkg = JSON.parse(pkgContent);

    if (pkg.workspaces) {
      if (Array.isArray(pkg.workspaces)) {
        pkg.workspaces.forEach((w: string) => globs.add(w));
      } else if (pkg.workspaces.packages && Array.isArray(pkg.workspaces.packages)) {
        pkg.workspaces.packages.forEach((w: string) => globs.add(w));
      }
    }
  } catch (err) {
    // No package.json or invalid
  }

  // 2. Check pnpm-workspace.yaml
  try {
    const pnpmPath = path.join(repoTempDir, "pnpm-workspace.yaml");
    const pnpmContent = await fs.readFile(pnpmPath, "utf8");
    // Simple regex parse for:
    // packages:
    //   - "apps/*"
    //   - 'packages/*'
    const lines = pnpmContent.split("\n");
    let inPackages = false;
    for (const line of lines) {
      if (line.trim().startsWith("packages:")) {
        inPackages = true;
        continue;
      }
      if (inPackages) {
        const match = line.match(/^\s*-\s*['"]?([^'"]+)['"]?/);
        if (match && match[1]) {
          globs.add(match[1]);
        } else if (line.trim() && !line.trim().startsWith("#")) {
          // If we hit a line that's not a list item or comment, we're likely out of the block
          inPackages = false;
        }
      }
    }
  } catch (err) {
    // No pnpm-workspace.yaml
  }

  if (globs.size === 0) {
    return [];
  }

  return resolveWorkspaceGlobs(repoTempDir, Array.from(globs));
}
