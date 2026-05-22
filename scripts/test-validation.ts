/**
 * Manual test script for input validation changes.
 * Run with: npx tsx scripts/test-validation.ts
 *
 * This script tests the validation endpoints manually.
 * Requires the dev server to be running on http://localhost:3000
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  body: any;
  passed: boolean;
}

const results: TestResult[] = [];

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key";

async function test(
  endpoint: string,
  method: string,
  body: any | null,
  expectedStatus: number,
  token?: string,
): Promise<TestResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    const actualToken = token === "test-token"
      ? jwt.sign({ userId: 1, email: "test@example.com" }, JWT_SECRET)
      : token;
    headers.Authorization = `Bearer ${actualToken}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  const passed = response.status === expectedStatus;

  const result: TestResult = {
    endpoint,
    method,
    status: response.status,
    body: data,
    passed,
  };

  results.push(result);

  console.log(
    `${passed ? "✓" : "✗"} ${method} ${endpoint} → ${response.status} (expected ${expectedStatus})`,
  );

  if (!passed) {
    console.log(`  Response: ${JSON.stringify(data, null, 2)}`);
  }

  return result;
}

async function runTests() {
  console.log("Running validation tests...\n");

  // Test 1: Suggest commit without any data
  await test(
    "/api/ai/suggest-commit",
    "POST",
    {},
    400,
    "test-token",
  );

  // Test 2: Suggest commit with empty arrays
  await test(
    "/api/ai/suggest-commit",
    "POST",
    { added: [], modified: [], deleted: [] },
    400,
    "test-token",
  );

  // Test 3: Suggest commit with valid data (will fail auth but validation passes first)
  // Note: This tests that validation happens before auth check

  // Test 4: GitHub import without URL
  await test(
    "/api/integrations/github/import",
    "POST",
    { token: "some-token" },
    400,
    "test-token",
  );

  // Test 5: GitHub import without token
  await test(
    "/api/integrations/github/import",
    "POST",
    { url: "https://github.com/owner/repo" },
    400,
    "test-token",
  );

  // Test 6: PR review without prUrl
  await test(
    "/api/ai/review-pr",
    "POST",
    { token: "some-token" },
    400,
    "test-token",
  );

  // Test 7: PR review without token
  await test(
    "/api/ai/review-pr",
    "POST",
    { prUrl: "https://github.com/owner/repo/pull/1" },
    400,
    "test-token",
  );

  // Test 8: Create repository without name
  await test(
    "/api/repositories",
    "POST",
    { url: "https://github.com/owner/repo" },
    400,
    "test-token",
  );

  // Test 9: Create repository without URL
  await test(
    "/api/repositories",
    "POST",
    { name: "test-repo" },
    400,
    "test-token",
  );

  // Test 10: Create repository with invalid URL
  await test(
    "/api/repositories",
    "POST",
    { name: "test-repo", url: "not-a-url" },
    400,
    "test-token",
  );

  // Test 10a: Create repository with invalid URL protocol
  await test(
    "/api/repositories",
    "POST",
    { name: "test-repo", url: "ftp://github.com/owner/repo" },
    400,
    "test-token",
  );

  // Test 10b: Create repository with invalid name type
  await test(
    "/api/repositories",
    "POST",
    { name: 123, url: "https://github.com/owner/repo" },
    400,
    "test-token",
  );

  // Test 10c: Create repository with name too long
  await test(
    "/api/repositories",
    "POST",
    { name: "a".repeat(101), url: "https://github.com/owner/repo" },
    400,
    "test-token",
  );

  // Test 10d: Create repository with URL too long
  await test(
    "/api/repositories",
    "POST",
    { name: "test-repo", url: "https://" + "a".repeat(2005) },
    400,
    "test-token",
  );

  // Test 10e: Create repository with invalid description type
  await test(
    "/api/repositories",
    "POST",
    { name: "test-repo", url: "https://github.com/owner/repo", description: 123 },
    400,
    "test-token",
  );

  // Test 10f: Create repository with description too long
  await test(
    "/api/repositories",
    "POST",
    { name: "test-repo", url: "https://github.com/owner/repo", description: "a".repeat(1005) },
    400,
    "test-token",
  );

  // Test 11: Invalid repository ID (alphabetic)
  await test(
    "/api/repositories/abc",
    "GET",
    null,
    400,
    "test-token",
  );

  // Test 11a: Invalid repository ID (negative)
  await test(
    "/api/repositories/-5",
    "GET",
    null,
    400,
    "test-token",
  );

  // Test 11b: Invalid repository ID (float)
  await test(
    "/api/repositories/3.14",
    "GET",
    null,
    400,
    "test-token",
  );

  // Test 11c: Invalid repository ID for analyze
  await test(
    "/api/repositories/-1/analyze",
    "POST",
    null,
    400,
    "test-token",
  );

  // Test 11d: Invalid repository ID for readme
  await test(
    "/api/repositories/-1/readme",
    "POST",
    null,
    400,
    "test-token",
  );

  // Test 11e: Invalid repository ID for stats
  await test(
    "/api/repositories/-1/stats",
    "GET",
    null,
    400,
    "test-token",
  );

  // Test 12: Chat without repositoryId
  await test(
    "/api/ai/chat",
    "POST",
    { question: "Hello" },
    400,
    "test-token",
  );

  // Test 13: Chat without question
  await test(
    "/api/ai/chat",
    "POST",
    { repositoryId: 1 },
    400,
    "test-token",
  );

  // Test 14: Analyze repository without repositoryId
  await test(
    "/api/ai/analyze-repository",
    "POST",
    { type: "overview" },
    400,
    "test-token",
  );

  // Test 15: Explain file without repositoryId
  await test(
    "/api/ai/explain-file",
    "POST",
    { filePath: "src/index.ts" },
    400,
    "test-token",
  );

  // Test 16: Analyze code without code
  await test(
    "/api/ai/analyze-code",
    "POST",
    { language: "typescript", analysisType: "quality" },
    400,
    "test-token",
  );

  // Summary
  console.log("\n--- Summary ---");
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`${passed}/${total} tests passed`);

  if (passed < total) {
    console.log("\nFailed tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.method} ${r.endpoint}: got ${r.status}`);
      });
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
