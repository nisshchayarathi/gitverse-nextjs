import prisma from "@/lib/prisma";

export interface SnapshotSummary {
  files: { path: string; imports: string[] }[];
}

export async function saveSnapshot(repositoryId: number, snapshot: SnapshotSummary) {
  const rec = await prisma.architectureSnapshot.create({
    data: {
      repositoryId,
      snapshot: snapshot as any,
    },
  });
  return rec;
}

function topLevelFolder(p: string) {
  const parts = p.split("/").filter(Boolean);
  return parts.length > 0 ? parts[0] : "root";
}

export function compareSnapshots(snapshotA: SnapshotSummary, snapshotB: SnapshotSummary) {
  // Build lookup
  const mapA = new Map(snapshotA.files.map((f) => [f.path, f]));
  const mapB = new Map(snapshotB.files.map((f) => [f.path, f]));

  const newFiles: string[] = [];
  const removedFiles: string[] = [];
  const addedDependencies: Array<{ from: string; to: string }> = [];
  const boundaryViolations: Array<{ from: string; to: string }> = [];

  for (const [pathB, fileB] of mapB) {
    if (!mapA.has(pathB)) {
      newFiles.push(pathB);
    }
    const a = mapA.get(pathB);
    const aImports = new Set(a?.imports || []);
    for (const imp of fileB.imports || []) {
      if (!aImports.has(imp)) {
        addedDependencies.push({ from: pathB, to: imp });
        if (topLevelFolder(pathB) !== topLevelFolder(imp)) {
          boundaryViolations.push({ from: pathB, to: imp });
        }
      }
    }
  }

  for (const [pathA] of mapA) {
    if (!mapB.has(pathA)) removedFiles.push(pathA);
  }

  // Compute a drift score: normalized combination
  const wNewFiles = Math.min(1, newFiles.length / 20);
  const wAddedDeps = Math.min(1, addedDependencies.length / 50);
  const wBoundary = Math.min(1, boundaryViolations.length / 10);

  let driftScore = 50;
  driftScore += wNewFiles * 20;
  driftScore += wAddedDeps * 20;
  driftScore += wBoundary * 30;
  driftScore = Math.max(0, Math.min(100, Math.round(driftScore)));

  const report = {
    newFiles,
    removedFiles,
    addedDependencies,
    boundaryViolations,
    driftScore,
  };

  return { report, driftScore };
}

export async function generateDriftReport(repositoryId: number, baselineId: number, comparedId: number) {
  const baseline = await prisma.architectureSnapshot.findUnique({ where: { id: baselineId } });
  const compared = await prisma.architectureSnapshot.findUnique({ where: { id: comparedId } });
  if (!baseline || !compared) throw new Error("Missing snapshot(s)");

  const summaryA = baseline.snapshot as SnapshotSummary;
  const summaryB = compared.snapshot as SnapshotSummary;
  const { report, driftScore } = compareSnapshots(summaryA, summaryB);

  const rec = await prisma.architectureDriftReport.create({
    data: {
      repositoryId,
      baselineSnapshotId: baselineId,
      comparedSnapshotId: comparedId,
      driftScore: driftScore,
      report: report as any,
    },
  });

  return { rec, report };
}

export async function listSnapshots(repositoryId: number, limit = 10) {
  return prisma.architectureSnapshot.findMany({
    where: { repositoryId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function listDriftReports(repositoryId: number, limit = 20) {
  return prisma.architectureDriftReport.findMany({
    where: { repositoryId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export default { saveSnapshot, compareSnapshots, generateDriftReport, listSnapshots, listDriftReports };
