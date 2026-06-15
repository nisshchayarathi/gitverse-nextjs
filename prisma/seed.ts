import "dotenv/config";
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";

const roadmap = [
  {
    phase: 1,
    title: "Project Foundation",
    goal: "Understand architecture, setup environment, contribution workflow",
    features: ["Project Setup", "Environment Configuration", "Local Development", "Repository Navigation"],
    status: "MERGED"
  },
  {
    phase: 2,
    title: "Repository Architecture Explorer",
    goal: "Visualize repository structure",
    features: ["Folder Tree Analysis", "Dependency Mapping", "Architecture Graph"],
    status: "MERGED"
  },
  {
    phase: 3,
    title: "Repository Understanding Engine",
    goal: "Explain codebase in plain English",
    features: ["File Summaries", "Folder Explanations", "Architecture Narratives"],
    status: "MERGED"
  },
  {
    phase: 4,
    title: "Contributor Onboarding Assistant",
    goal: "Help new contributors understand project",
    features: ["Beginner Roadmaps", "Learning Paths", "Contribution Guides"],
    status: "MERGED"
  },
  {
    phase: 5,
    title: "Issue Recommendation Engine",
    goal: "Match contributors to issues",
    features: ["Skill Matching", "Difficulty Detection", "Issue Prioritization"],
    status: "MERGED"
  },
  {
    phase: 6,
    title: "AI Contributor Mentor",
    goal: "Guide contributors step-by-step",
    features: ["Code Guidance", "File Suggestions", "Implementation Recommendations"],
    status: "MERGED"
  },
  {
    phase: 7,
    title: "Repository Learning Mode",
    goal: "Turn repositories into courses",
    features: ["Interactive Lessons", "Code Walkthroughs", "Architecture Tutorials"],
    status: "CLOSED"
  },
  {
    phase: 8,
    title: "Bug Detection Intelligence",
    goal: "Identify risky code",
    features: ["Hotspot Detection", "Risk Scoring", "Frequent Failure Analysis"],
    status: "CLOSED"
  },
  {
    phase: 9,
    title: "Repository Health Dashboard",
    goal: "Monitor project quality",
    features: ["Code Quality Metrics", "Issue Trends", "Contributor Analytics"],
    status: "CLOSED"
  },
  {
    phase: 10,
    title: "AI PR Reviewer",
    goal: "Review pull requests automatically",
    features: ["Code Review", "Best Practice Checks", "Optimization Suggestions"],
    status: "CLOSED"
  },
  {
    phase: 11,
    title: "Security Analysis Engine",
    goal: "Detect vulnerabilities",
    features: ["SSRF Detection", "XSS Detection", "Secret Leak Detection", "Dependency Vulnerabilities"],
    status: "OPEN"
  },
  {
    phase: 12,
    title: "Documentation Generator",
    goal: "Generate documentation automatically",
    features: ["README Generation", "API Documentation", "Architecture Documentation"],
    status: "OPEN"
  },
  {
    phase: 13,
    title: "Repository Timeline Intelligence",
    goal: "Understand repository evolution",
    features: ["Commit Analysis", "Architecture Evolution", "Historical Trends"],
    status: "OPEN"
  },
  {
    phase: 14,
    title: "Interview Preparation Engine",
    goal: "Generate repository-based interview questions",
    features: ["Architecture Questions", "System Design Questions", "Project-Specific Assessments"],
    status: "OPEN"
  },
  {
    phase: 15,
    title: "Developer Skill Assessment",
    goal: "Evaluate contributor readiness",
    features: ["Skill Testing", "Knowledge Assessment", "Progress Tracking"],
    status: "OPEN"
  },
  {
    phase: 16,
    title: "Knowledge Graph System",
    goal: "Create repository relationships graph",
    features: ["File Connections", "Dependency Networks", "Service Relationships"],
    status: "OPEN"
  },
  {
    phase: 17,
    title: "Multi-Repository Analysis",
    goal: "Compare repositories",
    features: ["Repository Comparison", "Architecture Benchmarking", "Similarity Detection"],
    status: "OPEN"
  },
  {
    phase: 18,
    title: "Repository Memory Layer",
    goal: "Persistent repository knowledge",
    features: ["Repository Memory", "Context Retention", "Learning History"],
    status: "OPEN"
  },
  {
    phase: 19,
    title: "AI Architecture Consultant",
    goal: "Suggest architecture improvements",
    features: ["Refactoring Advice", "Scalability Analysis", "System Design Recommendations"],
    status: "OPEN"
  },
  {
    phase: 20,
    title: "AI Refactoring Agent",
    goal: "Improve code automatically",
    features: ["Code Cleanup", "Optimization", "Pattern Improvements"],
    status: "OPEN"
  },
  {
    phase: 21,
    title: "AI Testing Agent",
    goal: "Generate and execute tests",
    features: ["Unit Tests", "Integration Tests", "Coverage Analysis"],
    status: "OPEN"
  },
  {
    phase: 22,
    title: "AI Documentation Agent",
    goal: "Maintain documentation automatically",
    features: ["Live Documentation", "Auto Updates", "Knowledge Synchronization"],
    status: "OPEN"
  },
  {
    phase: 23,
    title: "AI Security Agent",
    goal: "Continuous security monitoring",
    features: ["Threat Detection", "Risk Monitoring", "Security Audits"],
    status: "OPEN"
  },
  {
    phase: 24,
    title: "Multi-Agent Collaboration System",
    goal: "Multiple AI agents working together",
    features: ["Code Agent", "Testing Agent", "Security Agent", "Architecture Agent", "Documentation Agent", "Review Agent"],
    status: "OPEN"
  },
  {
    phase: 25,
    title: "GitVerse RepoOS",
    goal: "Complete AI-powered Repository Operating System",
    features: [
      "Repository Understanding", "Contributor Guidance", "Issue Solving", "PR Review",
      "Security Analysis", "Testing Automation", "Documentation Automation",
      "Architecture Intelligence", "Multi-Agent Collaboration", "Repository Memory",
      "Autonomous Development Workflows"
    ],
    status: "OPEN"
  }
];

async function main() {
  console.log("Seeding database...");

  if (process.env.NODE_ENV === "production") {
    console.error("⚠️  Safety Guard: Cannot run seed script in production environment.");
    process.exit(1);
  }

  console.log("Cleaning up existing data...");
  await prisma.user.deleteMany();

  console.log("Creating test user...");
  const hashedPassword = await bcrypt.hash("password123", 10);
  const testUser = await prisma.user.create({
    data: {
      email: "test@example.com",
      name: "Bhuvanesh",
      passwordHash: hashedPassword,
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=bhuvanesh",
    },
  });

  console.log("Creating GitVerse Evolution Roadmap Repository...");
  const repository = await prisma.repository.create({
    data: {
      name: "GitVerse-Evolution-Roadmap",
      url: "https://github.com/nisshchayarathi/gitverse-nextjs",
      description: "Transform GitVerse from a repository visualization tool into a complete AI-powered Repository Operating System (RepoOS).",
      defaultBranch: "main",
      isPrivate: false,
      stars: 125,
      forks: 32,
      size: 4589000,
      status: "completed",
      userId: testUser.id,
    },
  });

  // Create GitHubRepo record matching
  const githubRepo = await prisma.gitHubRepo.create({
    data: {
      userId: testUser.id,
      repoFullName: "nisshchayarathi/gitverse-nextjs",
      enabled: true,
    }
  });

  console.log("Seeding 25 Roadmap Phases...");
  for (const item of roadmap) {
    const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const branchName = `feature/phase-${item.phase}-${slug}`;

    console.log(`Seeding Phase ${item.phase}: ${item.title}`);

    // Create branch record
    await prisma.branch.create({
      data: {
        name: branchName,
        isDefault: false,
        commitCount: faker.number.int({ min: 3, max: 15 }),
        repositoryId: repository.id,
      }
    });

    // Create commit records for this phase branch
    const commitHash = faker.git.commitSha();
    await prisma.commit.create({
      data: {
        hash: commitHash,
        shortHash: commitHash.substring(0, 7),
        message: `feat(phase-${item.phase}): ${item.title} - ${item.goal}`,
        authorName: "Bhuvanesh",
        authorEmail: "test@example.com",
        committedAt: faker.date.recent({ days: item.phase }),
        branch: branchName,
        additions: faker.number.int({ min: 50, max: 500 }),
        deletions: faker.number.int({ min: 10, max: 200 }),
        filesChanged: faker.number.int({ min: 2, max: 10 }),
        repositoryId: repository.id,
      }
    });

    // Create PullRequest record
    const pullRequest = await prisma.pullRequest.create({
      data: {
        repoId: githubRepo.id,
        prNumber: item.phase,
        title: `Phase ${item.phase}: ${item.title} - ${item.goal}`,
        author: "Bhuvanesh",
        headSha: commitHash,
        htmlUrl: `https://github.com/nisshchayarathi/gitverse-nextjs/pull/${item.phase}`,
        status: item.status as any,
      }
    });

    // Create simulated automated review and analysis
    const reviewIssues = item.features.map((feat, index) => ({
      title: `Verification check for ${feat}`,
      severity: index === 0 ? "medium" : "low",
      category: "correctness",
      file: `docs/roadmap/phase-${item.phase}.md`,
      line: 10 + index,
      explanation: `Checks that the implementation guidelines for ${feat} are properly addressed in this phase's submission.`,
      suggestion: `Ensure standard unit tests are written for ${feat} integration.`
    }));

    const reviewResponse = {
      summary: `Automated review for Phase ${item.phase} (${item.title}). The changes successfully document and establish the foundations of the feature. All verified checklist features: ${item.features.join(", ")} are present.`,
      overallScore: faker.number.int({ min: 85, max: 98 }),
      issues: reviewIssues,
      praise: [
        `Excellent structural layout for ${item.title}.`,
        `Complete checklist for all requested features.`
      ]
    };

    await prisma.pRReview.create({
      data: {
        pullRequestId: pullRequest.id,
        headSha: commitHash,
        reviewText: reviewResponse.summary,
        rawJson: reviewResponse as any,
      }
    });

    await prisma.pRImpactAnalysis.create({
      data: {
        pullRequestId: pullRequest.id,
        headSha: commitHash,
        riskScore: faker.number.float({ min: 0.1, max: 0.4 }),
        impactSummary: `Safe release for Phase ${item.phase}. Changes are isolated to docs/roadmap and do not impact core auth/visualizer pipelines.`,
        breakingChanges: false,
        aiMetrics: {
          complexityDelta: 0.05,
          churnedLines: faker.number.int({ min: 50, max: 200 }),
        } as any,
      }
    });
  }

  // Create default defaultBranch branch
  await prisma.branch.create({
    data: {
      name: "main",
      isDefault: true,
      commitCount: 150,
      repositoryId: repository.id,
    }
  });

  // Seed default languages
  const langs = ["TypeScript", "JavaScript", "HTML", "CSS"];
  for (const lang of langs) {
    await prisma.language.create({
      data: {
        name: lang,
        percentage: lang === "TypeScript" ? 65.5 : lang === "JavaScript" ? 20.0 : lang === "CSS" ? 10.0 : 4.5,
        bytes: lang === "TypeScript" ? 3000000 : 1000000,
        repositoryId: repository.id,
      }
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
