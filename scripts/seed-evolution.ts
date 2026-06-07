import "dotenv/config";
import prisma from "../lib/prisma";

async function main() {
  console.log("Starting evolution seed script...");

  // Find test user
  const user = await prisma.user.findUnique({
    where: { email: "test@example.com" },
  });

  if (!user) {
    console.error("Test user test@example.com not found. Run db:seed first!");
    process.exit(1);
  }

  // Find first repository for test user
  const repository = await prisma.repository.findFirst({
    where: { userId: user.id },
  });

  if (!repository) {
    console.error("No repositories found for test user. Run db:seed first!");
    process.exit(1);
  }

  console.log(`Seeding evolution snapshots for repository: ${repository.name} (ID: ${repository.id})`);

  // Clear existing snapshots
  await prisma.architectureSnapshot.deleteMany({
    where: { repositoryId: repository.id },
  });

  // Snapshot 1: v1.0.0 (90 days ago)
  await prisma.architectureSnapshot.create({
    data: {
      repositoryId: repository.id,
      commitHash: "e1a90c128a3f8fa9d300b1a03ef92d847120a101",
      tagName: "v1.0.0",
      commitMessage: "Release v1.0.0 - Initial production release",
      committedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      dependencyGraph: {
        "src/main.ts": ["src/app.ts", "src/config.ts"],
        "src/app.ts": ["src/routes.ts", "src/database.ts"],
        "src/routes.ts": ["src/controllers/userController.ts"],
        "src/controllers/userController.ts": ["src/models/user.ts"],
        "src/database.ts": ["src/config.ts"],
      },
      metadata: {
        totalFiles: 8,
        totalLines: 820,
        totalSize: 24500,
        languages: [{ name: "TypeScript", percentage: 100 }],
      },
    },
  });

  // Snapshot 2: v1.1.0 (60 days ago)
  await prisma.architectureSnapshot.create({
    data: {
      repositoryId: repository.id,
      commitHash: "f2b01d239b4f9fb0e411c2b14fg03e958231b202",
      tagName: "v1.1.0",
      commitMessage: "Release v1.1.0 - Added authentication and product routes",
      committedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      dependencyGraph: {
        "src/main.ts": ["src/app.ts", "src/config.ts"],
        "src/app.ts": ["src/routes.ts", "src/database.ts", "src/middleware/auth.ts"],
        "src/routes.ts": ["src/controllers/userController.ts", "src/controllers/productController.ts"],
        "src/controllers/userController.ts": ["src/models/user.ts"],
        "src/controllers/productController.ts": ["src/models/product.ts"],
        "src/database.ts": ["src/config.ts"],
        "src/middleware/auth.ts": ["src/config.ts"],
      },
      metadata: {
        totalFiles: 11,
        totalLines: 1250,
        totalSize: 38200,
        languages: [{ name: "TypeScript", percentage: 95 }, { name: "HTML", percentage: 5 }],
      },
    },
  });

  // Snapshot 3: v1.2.0 (30 days ago)
  await prisma.architectureSnapshot.create({
    data: {
      repositoryId: repository.id,
      commitHash: "a3c12e340c5a0ac1f522d3c25hi14f069342c303",
      tagName: "v1.2.0",
      commitMessage: "Release v1.2.0 - Added payment gateway integration",
      committedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      dependencyGraph: {
        "src/main.ts": ["src/app.ts", "src/config.ts"],
        "src/app.ts": ["src/routes.ts", "src/database.ts", "src/middleware/auth.ts"],
        "src/routes.ts": ["src/controllers/userController.ts", "src/controllers/productController.ts", "src/controllers/paymentController.ts"],
        "src/controllers/userController.ts": ["src/models/user.ts"],
        "src/controllers/productController.ts": ["src/models/product.ts"],
        "src/controllers/paymentController.ts": ["src/models/payment.ts", "src/services/stripe.ts"],
        "src/database.ts": ["src/config.ts"],
        "src/middleware/auth.ts": ["src/config.ts"],
        "src/services/stripe.ts": ["src/config.ts"],
      },
      metadata: {
        totalFiles: 14,
        totalLines: 1740,
        totalSize: 52400,
        languages: [{ name: "TypeScript", percentage: 90 }, { name: "JavaScript", percentage: 8 }, { name: "HTML", percentage: 2 }],
      },
    },
  });

  // Snapshot 4: v2.0.0 (7 days ago)
  await prisma.architectureSnapshot.create({
    data: {
      repositoryId: repository.id,
      commitHash: "d4d23f451d6b1bd2g633e4d36jk25g170453d404",
      tagName: "v2.0.0",
      commitMessage: "Release v2.0.0 - Major modularization and dashboard UI features",
      committedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      dependencyGraph: {
        "src/main.ts": ["src/app.ts", "src/config.ts"],
        "src/app.ts": ["src/routes.ts", "src/database.ts", "src/middleware/auth.ts", "src/middleware/logger.ts"],
        "src/routes.ts": [
          "src/controllers/userController.ts",
          "src/controllers/productController.ts",
          "src/controllers/paymentController.ts",
          "src/controllers/analyticsController.ts"
        ],
        "src/controllers/userController.ts": ["src/models/user.ts", "src/services/authService.ts"],
        "src/controllers/productController.ts": ["src/models/product.ts"],
        "src/controllers/paymentController.ts": ["src/models/payment.ts", "src/services/stripe.ts"],
        "src/controllers/analyticsController.ts": ["src/models/analytics.ts", "src/services/analyticsService.ts"],
        "src/database.ts": ["src/config.ts"],
        "src/middleware/auth.ts": ["src/config.ts"],
        "src/middleware/logger.ts": [],
        "src/services/stripe.ts": ["src/config.ts"],
        "src/services/authService.ts": ["src/models/user.ts"],
        "src/services/analyticsService.ts": ["src/database.ts"],
      },
      metadata: {
        totalFiles: 20,
        totalLines: 2680,
        totalSize: 81200,
        languages: [{ name: "TypeScript", percentage: 85 }, { name: "JavaScript", percentage: 12 }, { name: "CSS", percentage: 3 }],
      },
    },
  });

  console.log("Evolution snapshots seeded. Now seeding commits with file changes...");

  // Delete existing commits of this repository
  await prisma.commit.deleteMany({
    where: { repositoryId: repository.id },
  });

  // Seed 10 realistic commits with multi-file modifications (logical coupling)
  const mockCommits = [
    {
      hash: "e1a90c128a3f8fa9d300b1a03ef92d847120a101",
      message: "Release v1.0.0 - Initial production release",
      files: ["src/main.ts", "src/app.ts", "src/config.ts", "src/database.ts"],
      committedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    },
    {
      hash: "f2b01d239b4f9fb0e411c2b14fg03e958231b202",
      message: "Release v1.1.0 - Added authentication and product routes",
      files: ["src/app.ts", "src/routes.ts", "src/middleware/auth.ts"],
      committedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    },
    {
      hash: "a3c12e340c5a0ac1f522d3c25hi14f069342c303",
      message: "Release v1.2.0 - Added payment gateway integration",
      files: ["src/routes.ts", "src/controllers/paymentController.ts", "src/services/stripe.ts", "src/models/payment.ts"],
      committedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
    {
      hash: "d4d23f451d6b1bd2g633e4d36jk25g170453d404",
      message: "Release v2.0.0 - Major modularization and dashboard UI features",
      files: ["src/routes.ts", "src/controllers/analyticsController.ts", "src/services/analyticsService.ts", "src/models/analytics.ts"],
      committedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
    {
      hash: "c000000000000000000000000000000000000001",
      message: "Refactor user authentication and service layer",
      files: ["src/controllers/userController.ts", "src/services/authService.ts", "src/models/user.ts"],
      committedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
    },
    {
      hash: "c000000000000000000000000000000000000002",
      message: "Fix Stripe webhook parsing and add database log",
      files: ["src/controllers/paymentController.ts", "src/services/stripe.ts"],
      committedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    },
    {
      hash: "c000000000000000000000000000000000000003",
      message: "Update product query logic and schemas",
      files: ["src/controllers/productController.ts", "src/models/product.ts"],
      committedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    },
    {
      hash: "c000000000000000000000000000000000000004",
      message: "Improve user controller input validation",
      files: ["src/controllers/userController.ts", "src/models/user.ts"],
      committedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
    {
      hash: "c000000000000000000000000000000000000005",
      message: "Log analytics events during transaction completion",
      files: ["src/controllers/analyticsController.ts", "src/services/analyticsService.ts"],
      committedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      hash: "c000000000000000000000000000000000000006",
      message: "Add authorization checking on analytical routes",
      files: ["src/routes.ts", "src/middleware/auth.ts"],
      committedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    }
  ];

  for (const c of mockCommits) {
    const commit = await prisma.commit.create({
      data: {
        hash: c.hash,
        shortHash: c.hash.substring(0, 7),
        message: c.message,
        authorName: "Ansel Graham",
        authorEmail: "ansel.g@gmail.com",
        committedAt: c.committedAt,
        branch: "main",
        additions: Math.floor(Math.random() * 200) + 10,
        deletions: Math.floor(Math.random() * 50) + 2,
        filesChanged: c.files.length,
        repositoryId: repository.id,
      },
    });

    // Create file change records for this commit
    await prisma.fileChange.createMany({
      data: c.files.map((file) => ({
        path: file,
        additions: Math.floor(Math.random() * 40) + 5,
        deletions: Math.floor(Math.random() * 10),
        changeType: "MODIFIED",
        commitId: commit.id,
      })),
    });
  }

  // Set the job status to DONE so that the page doesn't show analyzing loading spinner
  const latestJob = await prisma.analysisJob.findFirst({
    where: { repositoryId: repository.id },
    orderBy: { createdAt: "desc" },
  });

  if (latestJob) {
    await prisma.analysisJob.update({
      where: { id: latestJob.id },
      data: { status: "DONE", progressPercent: 100 },
    });
  }

  console.log("Evolution snapshots and commits seeded successfully.");
}

main()
  .catch((e) => {
    console.error("Error seeding evolution data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
