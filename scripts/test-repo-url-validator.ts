/**
 * Test script for Repository URL Validator
 * 
 * Run with: npx tsx scripts/test-repo-url-validator.ts
 */

import {
  validateRepoUrl,
  isValidRepoUrl,
  normalizeRepoUrl,
  extractRepoInfo,
  type ParsedRepoUrl,
} from "../src/utils/repoUrlValidator";

interface TestCase {
  name: string;
  url: string;
  expectedValid: boolean;
  expectedParsed?: Partial<ParsedRepoUrl>;
  expectedErrorContains?: string;
}

let passed = 0;
let failed = 0;

function assertEqual<T>(actual: T, expected: T, testName: string): boolean {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  ✓ ${testName}`);
    passed++;
    return true;
  } else {
    console.log(`  ✗ ${testName}`);
    console.log(`    Expected: ${JSON.stringify(expected)}`);
    console.log(`    Actual:   ${JSON.stringify(actual)}`);
    failed++;
    return false;
  }
}

function runTest(test: TestCase): void {
  console.log(`\nTesting: ${test.name}`);
  console.log(`  URL: "${test.url}"`);

  const result = validateRepoUrl(test.url);

  // Check validity
  assertEqual(result.isValid, test.expectedValid, `isValid should be ${test.expectedValid}`);

  // If valid, check parsed data
  if (test.expectedValid && test.expectedParsed) {
    if (result.parsed) {
      const expected = test.expectedParsed;
      if (expected.normalizedUrl) {
        assertEqual(result.parsed.normalizedUrl, expected.normalizedUrl, "normalizedUrl");
      }
      if (expected.platform) {
        assertEqual(result.parsed.platform, expected.platform, "platform");
      }
      if (expected.owner) {
        assertEqual(result.parsed.owner, expected.owner, "owner");
      }
      if (expected.repo) {
        assertEqual(result.parsed.repo, expected.repo, "repo");
      }
    } else {
      console.log(`  ✗ Expected parsed data but got none`);
      failed++;
    }
  }

  // If invalid, check error message
  if (!test.expectedValid && test.expectedErrorContains) {
    if (result.error) {
      if (result.error.includes(test.expectedErrorContains)) {
        console.log(`  ✓ Error message contains "${test.expectedErrorContains}"`);
        passed++;
      } else {
        console.log(`  ✗ Error message should contain "${test.expectedErrorContains}"`);
        console.log(`    Actual error: "${result.error}"`);
        failed++;
      }
    } else {
      console.log(`  ✗ Expected error message but got none`);
      failed++;
    }
  }
}

async function runTests(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Repository URL Validator Tests");
  console.log("=".repeat(60));

  // Valid HTTPS URLs
  console.log("\n" + "─".repeat(40));
  console.log("Valid HTTPS URLs");
  console.log("─".repeat(40));

  runTest({
    name: "Standard GitHub HTTPS URL",
    url: "https://github.com/owner/repo",
    expectedValid: true,
    expectedParsed: {
      normalizedUrl: "https://github.com/owner/repo",
      platform: "github",
      owner: "owner",
      repo: "repo",
    },
  });

  runTest({
    name: "GitHub HTTPS URL with www prefix",
    url: "https://www.github.com/owner/repo",
    expectedValid: true,
    expectedParsed: {
      normalizedUrl: "https://github.com/owner/repo",
      platform: "github",
    },
  });

  runTest({
    name: "GitHub URL with .git extension",
    url: "https://github.com/owner/repo.git",
    expectedValid: true,
    expectedParsed: {
      normalizedUrl: "https://github.com/owner/repo",
      repo: "repo",
    },
  });

  runTest({
    name: "GitLab HTTPS URL",
    url: "https://gitlab.com/owner/repo",
    expectedValid: true,
    expectedParsed: {
      platform: "gitlab",
    },
  });

  runTest({
    name: "Bitbucket HTTPS URL",
    url: "https://bitbucket.org/owner/repo",
    expectedValid: true,
    expectedParsed: {
      platform: "bitbucket",
    },
  });

  runTest({
    name: "URL with hyphens and underscores",
    url: "https://github.com/my-org/my-repo_v2",
    expectedValid: true,
    expectedParsed: {
      owner: "my-org",
      repo: "my-repo_v2",
    },
  });

  runTest({
    name: "URL without protocol",
    url: "github.com/owner/repo",
    expectedValid: true,
    expectedParsed: {
      normalizedUrl: "https://github.com/owner/repo",
    },
  });

  runTest({
    name: "URL with trailing slash",
    url: "https://github.com/owner/repo/",
    expectedValid: true,
    expectedParsed: {
      normalizedUrl: "https://github.com/owner/repo",
    },
  });

  runTest({
    name: "URL with multiple trailing slashes",
    url: "https://github.com/owner/repo///",
    expectedValid: true,
    expectedParsed: {
      normalizedUrl: "https://github.com/owner/repo",
    },
  });

  runTest({
    name: "URL with .git and trailing slash",
    url: "https://github.com/owner/repo.git/",
    expectedValid: true,
    expectedParsed: {
      normalizedUrl: "https://github.com/owner/repo",
    },
  });

  runTest({
    name: "URL with www prefix without protocol",
    url: "www.github.com/owner/repo",
    expectedValid: true,
    expectedParsed: {
      normalizedUrl: "https://github.com/owner/repo",
    },
  });

  // Valid SSH URLs
  console.log("\n" + "─".repeat(40));
  console.log("Valid SSH URLs");
  console.log("─".repeat(40));

  runTest({
    name: "GitHub SSH URL",
    url: "git@github.com:owner/repo.git",
    expectedValid: true,
    expectedParsed: {
      normalizedUrl: "https://github.com/owner/repo",
      platform: "github",
      owner: "owner",
      repo: "repo",
    },
  });

  runTest({
    name: "SSH URL without .git extension",
    url: "git@github.com:owner/repo",
    expectedValid: true,
    expectedParsed: {
      normalizedUrl: "https://github.com/owner/repo",
    },
  });

  runTest({
    name: "GitLab SSH URL",
    url: "git@gitlab.com:owner/repo.git",
    expectedValid: true,
    expectedParsed: {
      platform: "gitlab",
    },
  });

  runTest({
    name: "SSH URL with uppercase GIT prefix",
    url: "GIT@github.com:owner/repo.git",
    expectedValid: true,
    expectedParsed: {
      normalizedUrl: "https://github.com/owner/repo",
    },
  });

  // Invalid URLs
  console.log("\n" + "─".repeat(40));
  console.log("Invalid URLs");
  console.log("─".repeat(40));

  runTest({
    name: "Empty URL",
    url: "",
    expectedValid: false,
    expectedErrorContains: "required",
  });

  runTest({
    name: "Whitespace-only URL",
    url: "   ",
    expectedValid: false,
  });

  runTest({
    name: "Non-URL string",
    url: "not-a-url",
    expectedValid: false,
  });

  runTest({
    name: "URL from self-hosted GitLab (unsupported)",
    url: "https://gitlab.example.com/owner/repo",
    expectedValid: false,
    expectedErrorContains: "Could not parse",  // It detects GitLab but can't parse self-hosted
  });

  runTest({
    name: "Malformed SSH URL",
    url: "git@github.com:repo",
    expectedValid: false,
    expectedErrorContains: "Invalid SSH URL format",
  });

  runTest({
    name: "URL with only owner (no repo)",
    url: "https://github.com/owner",
    expectedValid: false,
  });

  runTest({
    name: "Owner/repo shorthand",
    url: "owner/repo",
    expectedValid: false,
    expectedErrorContains: "Incomplete URL format",
  });

  runTest({
    name: "Repo name only",
    url: "my-repo",
    expectedValid: false,
    expectedErrorContains: "Repository name alone is not sufficient",
  });

  // URL Trimming
  console.log("\n" + "─".repeat(40));
  console.log("URL Trimming");
  console.log("─".repeat(40));

  runTest({
    name: "URL with leading/trailing whitespace",
    url: "  https://github.com/owner/repo  ",
    expectedValid: true,
    expectedParsed: {
      normalizedUrl: "https://github.com/owner/repo",
    },
  });

  // Test helper functions
  console.log("\n" + "─".repeat(40));
  console.log("Helper Functions");
  console.log("─".repeat(40));

  // isValidRepoUrl
  console.log("\nTesting isValidRepoUrl:");
  assertEqual(isValidRepoUrl("https://github.com/owner/repo"), true, "valid URL returns true");
  assertEqual(isValidRepoUrl("git@github.com:owner/repo.git"), true, "valid SSH URL returns true");
  assertEqual(isValidRepoUrl("not-a-url"), false, "invalid URL returns false");
  assertEqual(isValidRepoUrl(""), false, "empty URL returns false");

  // normalizeRepoUrl
  console.log("\nTesting normalizeRepoUrl:");
  assertEqual(normalizeRepoUrl("git@github.com:owner/repo.git"), "https://github.com/owner/repo", "SSH to HTTPS");
  assertEqual(normalizeRepoUrl("https://www.github.com/owner/repo"), "https://github.com/owner/repo", "Remove www");
  assertEqual(normalizeRepoUrl("https://github.com/owner/repo.git"), "https://github.com/owner/repo", "Remove .git");
  assertEqual(normalizeRepoUrl("not-a-url"), "not-a-url", "Invalid URL returns original");

  // extractRepoInfo
  console.log("\nTesting extractRepoInfo:");
  const httpsInfo = extractRepoInfo("https://github.com/owner/repo");
  assertEqual(httpsInfo?.platform, "github", "HTTPS URL platform");
  assertEqual(httpsInfo?.owner, "owner", "HTTPS URL owner");
  assertEqual(httpsInfo?.repo, "repo", "HTTPS URL repo");

  const sshInfo = extractRepoInfo("git@gitlab.com:my-org/my-project");
  assertEqual(sshInfo?.platform, "gitlab", "SSH URL platform");
  assertEqual(sshInfo?.owner, "my-org", "SSH URL owner");
  assertEqual(sshInfo?.repo, "my-project", "SSH URL repo");

  assertEqual(extractRepoInfo("not-a-url"), null, "Invalid URL returns null");

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total: ${passed + failed}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log("\n❌ Some tests failed!");
    process.exit(1);
  } else {
    console.log("\n✅ All tests passed!");
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});