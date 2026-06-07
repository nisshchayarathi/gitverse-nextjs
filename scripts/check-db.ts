import "dotenv/config";
import prisma from "../lib/prisma";

async function main() {
  console.log("=== Checking Database Content ===");
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true }
  });
  console.log("Users:", users);

  const repos = await prisma.repository.findMany({
    include: {
      _count: {
        select: {
          commits: true,
          contributors: true,
          files: true,
          branches: true,
          architectureSnapshots: true,
        }
      }
    }
  });
  console.log("Repositories:", repos.map(r => ({
    id: r.id,
    name: r.name,
    url: r.url,
    userId: r.userId,
    status: r.status,
    counts: r._count
  })));

  const jobs = await prisma.analysisJob.findMany({
    orderBy: { createdAt: "desc" }
  });
  console.log("Analysis Jobs:", jobs.map(j => ({
    id: j.id,
    repositoryId: j.repositoryId,
    status: j.status,
    progress: j.progressPercent,
    error: j.error,
    createdAt: j.createdAt
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
