import { describe, it, expect, vi } from "vitest";
import { GitService } from "../../lib/services/gitService";

describe("GitService - getContributors", () => {
  it("should count commits, not files changed", async () => {
    const gitService = new GitService("/fake/path");

    // Mock spawnGit to return simulated git log output
    const mockOutput = `
Alice Smith|alice@example.com|2026-06-02T10:00:00Z
5\t2\tsrc/index.js
10\t5\tsrc/utils.js
8\t3\tsrc/helpers.js

Alice Smith|alice@example.com|2026-06-01T12:00:00Z
15\t1\ttests/test.js
`;

    vi.spyOn(gitService as any, "spawnGit").mockResolvedValue({
      stdout: mockOutput,
      stderr: "",
    });

    const contributors = await gitService.getContributors();

    expect(contributors).toHaveLength(1);
    const alice = contributors[0];
    expect(alice.name).toBe("Alice Smith");
    expect(alice.email).toBe("alice@example.com");
    expect(alice.commits).toBe(2); // 2 commits (not 4 files changed!)
    expect(alice.additions).toBe(38); // 5 + 10 + 8 + 15
    expect(alice.deletions).toBe(11); // 2 + 5 + 3 + 1
  });

  it("should correctly initialize and aggregate commits, additions, and deletions for multiple authors", async () => {
    const gitService = new GitService("/fake/path");

    const mockOutput = `
John Doe|john@example.com|2026-06-02T10:00:00Z
5\t2\tfile1.js
10\t3\tfile2.js

Jane Smith|jane@example.com|2026-06-01T15:45:00Z
20\t5\tsrc/main.ts

John Doe|john@example.com|2026-06-01T10:00:00Z
8\t1\tfile3.js
`;

    vi.spyOn(gitService as any, "spawnGit").mockResolvedValue({
      stdout: mockOutput,
      stderr: "",
    });

    const contributors = await gitService.getContributors();

    expect(contributors).toHaveLength(2);

    const john = contributors.find(c => c.email === "john@example.com")!;
    expect(john.commits).toBe(2);
    expect(john.additions).toBe(23); // 5 + 10 + 8
    expect(john.deletions).toBe(6); // 2 + 3 + 1

    const jane = contributors.find(c => c.email === "jane@example.com")!;
    expect(jane.commits).toBe(1);
    expect(jane.additions).toBe(20);
    expect(jane.deletions).toBe(5);
  });
});
