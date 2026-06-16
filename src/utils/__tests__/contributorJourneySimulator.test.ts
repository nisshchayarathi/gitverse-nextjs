import { simulateContributorJourney } from "../contributorJourneySimulator";

describe("contributor journey simulator", () => {
  it("infers authentication category and ranks auth files highly", () => {
    const repository = {
      files: [
        { path: "src/auth.ts", size: 18_000 },
        { path: "src/middleware.ts", size: 9_000 },
        { path: "src/sessionService.ts", size: 11_000 },
        { path: "src/components/LoginForm.tsx", size: 12_000 },
        { path: "src/components/OAuthCallback.tsx", size: 14_000 },
        { path: "src/utils/helpers.ts", size: 6_000 },
      ],
      commits: [
        {
          hash: "abc123",
          shortHash: "abc123",
          message: "Fix auth provider flow",
          author: "Dev",
          date: new Date("2025-01-01T00:00:00.000Z"),
          filesChanged: 2,
        },
        {
          hash: "def456",
          shortHash: "def456",
          message: "Improve login session handling",
          author: "Dev",
          date: new Date("2025-01-02T00:00:00.000Z"),
          filesChanged: 3,
        },
      ],
    };

    const result = simulateContributorJourney(repository, {
      goal: "Add OAuth Provider",
      experienceLevel: "Intermediate",
      maxSteps: 5,
    });

    expect(result.category).toBe("Authentication");
    expect(result.learningPath[0].file).toBe("src/auth.ts");
    expect(result.learningPath.length).toBe(5);
    expect(result.estimatedTime).toBeGreaterThanOrEqual(10);
    expect(result.learningPath.some((step) => step.file === "src/middleware.ts")).toBe(true);
    expect(result.learningPath.some((step) => step.file === "src/components/OAuthCallback.tsx")).toBe(true);
  });
});
