import "dotenv/config";
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";

async function main() {
  console.log("Seeding database...");

  if (process.env.NODE_ENV === "production") {
    console.error("⚠️  Safety Guard: Cannot run seed script in production environment.");
    console.error("Aborting to prevent accidental data loss.");
    process.exit(1);
  }

  console.log("Cleaning up existing data...");
  // Clear all users, which will cascade and delete repositories, commits, branches, etc.
  await prisma.user.deleteMany();

  console.log("Creating users...");
  const users = [];
  
  // Create a predictable test user
  const hashedPassword = await bcrypt.hash("password123", 10);
  const testUser = await prisma.user.create({
    data: {
      email: "test@example.com",
      name: "Test User",
      passwordHash: hashedPassword,
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=test",
    },
  });
  users.push(testUser);
  console.log("Created test user: test@example.com");

  // Create 9 random users
  for (let i = 0; i < 9; i++) {
    const user = await prisma.user.create({
      data: {
        email: `user${i}_${faker.internet.email()}`,
        name: faker.person.fullName(),
        image: faker.image.avatar(),
        passwordHash: hashedPassword,
      },
    });
    users.push(user);
  }

  console.log("Creating repositories and related data...");
  const jobStatuses = ["QUEUED", "PROCESSING", "DONE", "FAILED"] as const;

  for (let i = 0; i < 20; i++) {
    const user = faker.helpers.arrayElement(users);
    const repoName = `${faker.word.adjective()}-${faker.word.noun()}`;
    
    // Create repository
    const repository = await prisma.repository.create({
      data: {
        name: repoName,
        url: `https://github.com/${faker.internet.username()}/${repoName}`,
        description: faker.lorem.sentence(),
        defaultBranch: "main",
        isPrivate: faker.datatype.boolean(),
        stars: faker.number.int({ min: 0, max: 1000 }),
        forks: faker.number.int({ min: 0, max: 200 }),
        size: faker.number.int({ min: 1000, max: 1000000 }),
        status: faker.helpers.arrayElement(["pending", "analyzing", "completed", "failed"]),
        userId: user.id,
      },
    });

    // Create branches
    const branches = [];
    for (let j = 0; j < faker.number.int({ min: 1, max: 5 }); j++) {
      const isMain = j === 0;
      const branchName = isMain ? "main" : `branch-${j}-${faker.git.branch()}`;
      const branch = await prisma.branch.create({
        data: {
          name: branchName,
          isDefault: isMain,
          commitCount: faker.number.int({ min: 10, max: 500 }),
          repositoryId: repository.id,
        },
      });
      branches.push(branch);
    }

    // Create commits
    for (let k = 0; k < faker.number.int({ min: 5, max: 20 }); k++) {
      const hash = faker.git.commitSha();
      await prisma.commit.create({
        data: {
          hash: hash,
          shortHash: hash.substring(0, 7),
          message: faker.git.commitMessage(),
          authorName: faker.person.fullName(),
          authorEmail: faker.internet.email(),
          committedAt: faker.date.recent({ days: 30 }),
          branch: faker.helpers.arrayElement(branches).name,
          additions: faker.number.int({ min: 1, max: 500 }),
          deletions: faker.number.int({ min: 0, max: 200 }),
          filesChanged: faker.number.int({ min: 1, max: 15 }),
          repositoryId: repository.id,
        },
      });
    }

    // Create files
    const extensions = [".ts", ".tsx", ".js", ".md", ".css"];
    for (let l = 0; l < faker.number.int({ min: 5, max: 20 }); l++) {
      const ext = faker.helpers.arrayElement(extensions);
      const name = `file${l}_${faker.word.noun()}${ext}`;
      await prisma.file.create({
        data: {
          path: `src/dir${l}/${name}`,
          name: name,
          extension: ext,
          size: faker.number.int({ min: 100, max: 50000 }),
          lines: faker.number.int({ min: 10, max: 1000 }),
          repositoryId: repository.id,
        },
      });
    }

    // Create languages
    const langs = ["TypeScript", "JavaScript", "HTML", "CSS", "Python", "Rust", "Go"];
    const repoLangs = faker.helpers.arrayElements(langs, faker.number.int({ min: 1, max: 3 }));
    for (const lang of repoLangs) {
      await prisma.language.create({
        data: {
          name: lang,
          percentage: faker.number.float({ min: 5, max: 95, multipleOf: 0.1 }),
          bytes: faker.number.int({ min: 1000, max: 100000 }),
          repositoryId: repository.id,
        },
      });
    }

    // Create contributors
    for (let c = 0; c < faker.number.int({ min: 1, max: 5 }); c++) {
      await prisma.contributor.create({
        data: {
          name: faker.person.fullName(),
          email: `contrib${c}_${faker.internet.email()}`,
          avatar: faker.image.avatar(),
          commits: faker.number.int({ min: 1, max: 100 }),
          additions: faker.number.int({ min: 10, max: 5000 }),
          deletions: faker.number.int({ min: 0, max: 2000 }),
          percentage: faker.number.float({ min: 1, max: 50, multipleOf: 0.1 }),
          firstCommit: faker.date.past({ years: 1 }),
          lastCommit: faker.date.recent({ days: 30 }),
          repositoryId: repository.id,
        },
      });
    }

    // Create AnalysisJob
    await prisma.analysisJob.create({
      data: {
        status: faker.helpers.arrayElement(jobStatuses),
        type: "repository_analysis",
        repositoryId: repository.id,
        userId: user.id,
        progressPercent: faker.number.int({ min: 0, max: 100 }),
      },
    });
  }

  console.log("Seeding finished successfully.");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
