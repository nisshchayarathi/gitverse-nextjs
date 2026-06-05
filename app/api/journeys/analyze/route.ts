import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { DependencyGraphService } from "@/lib/services/dependencyGraphService";
import { FileImportanceRanker } from "@/lib/services/fileImportanceRanker";
import { GitService } from "@/lib/services/gitService";
import { authOptions } from "@/lib/auth";
import * as os from "os";
import * as path from "path";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { repositoryId } = body;

    if (!repositoryId) {
      return NextResponse.json(
        { error: "Missing repositoryId" },
        { status: 400 },
      );
    }

    // Verify repository belongs to user
    const repository = await prisma.repository.findFirst({
      where: { id: repositoryId, userId: user.id },
    });

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 },
      );
    }

    // Clone repository to temp directory
    const tempDir = path.join(os.tmpdir(), `repo-${repositoryId}-${Date.now()}`);
    const gitService = new GitService();

    try {
      // Clone the repository
      await gitService.cloneRepository(repository.url, tempDir);

      // Build dependency graph
      const depService = new DependencyGraphService();
      const graph = await depService.buildDependencyGraph(tempDir, repositoryId);

      // Calculate importance scores
      const importanceScores = depService.calculateImportanceScores(graph);
      const rankedFiles = depService.getRankedFiles(graph, importanceScores);

      // Find all source files
      const sourceFiles = await findSourceFiles(tempDir);

      // Build maps for easy lookup
      const incomingDepsMap = new Map<string, number>();
      const outgoingDepsMap = new Map<string, number>();

      for (const file of rankedFiles) {
        incomingDepsMap.set(file.filePath, file.incomingDeps);
        outgoingDepsMap.set(file.filePath, file.outgoingDeps);
      }

      // Rank files and save to database
      const ranker = new FileImportanceRanker();
      await ranker.rankFilesAndSaveToDatabase(
        repositoryId,
        incomingDepsMap,
        outgoingDepsMap,
        sourceFiles,
        tempDir,
      );

      // Clean up temp directory
      await gitService.cleanupTemporaryDirectory(tempDir);

      return NextResponse.json({
        success: true,
        message: "Repository analyzed successfully",
        stats: {
          totalFiles: rankedFiles.length,
          topFiles: rankedFiles.slice(0, 10),
        },
      });
    } catch (error) {
      // Clean up on error
      await gitService.cleanupTemporaryDirectory(tempDir).catch(console.error);
      throw error;
    }
  } catch (error) {
    console.error("Error analyzing repository:", error);
    return NextResponse.json(
      {
        error: "Failed to analyze repository",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

async function findSourceFiles(dirPath: string): Promise<string[]> {
  const fs = await import("fs/promises");
  const files: string[] = [];
  const excludeDirs = [
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    "coverage",
    ".env",
  ];
  const extensions = [".ts", ".tsx", ".js", ".jsx"];

  async function recursiveFind(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!excludeDirs.includes(entry.name)) {
            await recursiveFind(fullPath);
          }
        } else if (entry.isFile()) {
          if (extensions.some((ext) => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error);
    }
  }

  await recursiveFind(dirPath);
  return files;
}
