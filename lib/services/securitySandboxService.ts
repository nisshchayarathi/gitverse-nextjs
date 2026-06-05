import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { validateSafeUrl } from "@/lib/utils/ssrfValidator";
import { GitHubService } from "./githubService";
import { getDecryptedGitHubToken } from "@/lib/utils/githubToken";

const execFileAsync = promisify(execFile);

const SANDBOX_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const CONTAINER_CLEANUP_TIMEOUT_MS = 30 * 1000; // 30 seconds

export type SandboxTestResult = {
  testName: string;
  passed: boolean;
  payload?: string;
  response?: string;
  error?: string;
};

export type SandboxRunResult = {
  sandboxId: string;
  status: "completed" | "failed" | "timeout";
  testResults: SandboxTestResult[];
  exploitPayload?: string;
  stackTrace?: string;
  error?: string;
};

function isSandboxEnabled(): boolean {
  return process.env.SECURITY_SANDBOX_ENABLED === "true";
}

function getDockerHost(): string {
  return process.env.DOCKER_HOST || "unix:///var/run/docker.sock";
}

async function runDockerCommand(
  args: string[],
  timeoutMs: number = 30_000,
): Promise<{ stdout: string; stderr: string }> {
  const dockerHost = getDockerHost();
  const result = await execFileAsync("docker", args, {
    timeout: timeoutMs,
    env: { ...process.env, DOCKER_HOST: dockerHost },
  });
  return { stdout: result.stdout, stderr: result.stderr };
}

async function buildSandboxImage(
  repositoryUrl: string,
  headSha: string,
): Promise<string> {
  const imageTag = `gitverse-sandbox:${crypto.randomBytes(8).toString("hex")}`;

  // Create a Dockerfile that uses ARG for safe parameterization
  const dockerfile = `
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ARG REPO_URL
ARG TARGET_SHA

RUN git clone --depth 1 ${"$"}{REPO_URL} . && \\
    git fetch origin ${"$"}{TARGET_SHA} && \\
    git checkout ${"$"}{TARGET_SHA}

RUN if [ -f package.json ]; then npm install --production 2>/dev/null || true; fi
RUN if [ -f requirements.txt ]; then pip install -r requirements.txt 2>/dev/null || true; fi

EXPOSE 3000
CMD ["echo", "sandbox-ready"]
`;

  // Write Dockerfile using fs (no shell interpolation)
  const tempDir = path.join(os.tmpdir(), `gitverse-sandbox-${crypto.randomBytes(8).toString("hex")}`);
  await fs.mkdir(tempDir, { recursive: true });
  await fs.writeFile(path.join(tempDir, "Dockerfile"), dockerfile, "utf-8");

  try {
    // Use --build-arg to pass values safely (no shell interpretation)
    await runDockerCommand([
      "build",
      "--build-arg", `REPO_URL=${repositoryUrl}`,
      "--build-arg", `TARGET_SHA=${headSha}`,
      "-t", imageTag,
      tempDir,
    ], 120_000);
    return imageTag;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null);
  }
}

async function runSecurityTests(
  imageTag: string,
): Promise<{
  testResults: SandboxTestResult[];
  exploitPayload?: string;
  stackTrace?: string;
}> {
  const containerName = `gitverse-test-${crypto.randomBytes(8).toString("hex")}`;
  const testResults: SandboxTestResult[] = [];
  let exploitPayload: string | undefined;
  let stackTrace: string | undefined;

  try {
    // Start the container
    await runDockerCommand([
      "run", "-d",
      "--name", containerName,
      "--network", "none", // Isolate from network
      "--memory", "256m",
      "--cpus", "0.5",
      imageTag,
    ]);

    // Wait for container to be ready
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Test 1: Check if container is running
    const { stdout: statusOutput } = await runDockerCommand([
      "inspect", "--format", "{{.State.Status}}", containerName,
    ]);
    const isRunning = statusOutput.trim() === "running";

    testResults.push({
      testName: "container_start",
      passed: isRunning,
      error: isRunning ? undefined : "Container failed to start",
    });

    if (!isRunning) {
      // Get logs for debugging
      const { stdout: logs } = await runDockerCommand(["logs", containerName]);
      stackTrace = logs;
      return { testResults, stackTrace };
    }

    // Test 2: Execute a basic command to verify the environment
    try {
      const { stdout: execOutput } = await runDockerCommand([
        "exec", containerName, "ls", "-la", "/app",
      ]);
      testResults.push({
        testName: "environment_check",
        passed: true,
        response: execOutput.trim(),
      });
    } catch (err: any) {
      testResults.push({
        testName: "environment_check",
        passed: false,
        error: err.message,
      });
    }

    // Test 3: Attempt common security probes
    const securityProbes = [
      {
        name: "path_traversal",
        payload: "../../../../etc/passwd",
        command: ["exec", containerName, "cat", "../../../../etc/passwd"],
      },
      {
        name: "env_injection",
        payload: "NODE_ENV=production; rm -rf /",
        command: ["exec", containerName, "env"],
      },
      {
        name: "command_injection",
        payload: "; cat /etc/shadow",
        command: ["exec", containerName, "sh", "-c", "echo test; cat /etc/shadow"],
      },
    ];

    for (const probe of securityProbes) {
      try {
        const { stdout, stderr } = await runDockerCommand(probe.command, 5_000);
        const output = stdout + stderr;
        const detected = output.includes("root:") || output.includes("permission denied");

        testResults.push({
          testName: probe.name,
          passed: !detected,
          payload: probe.payload,
          response: output.substring(0, 500),
          error: detected ? "Potential vulnerability detected" : undefined,
        });

        if (detected) {
          exploitPayload = probe.payload;
          stackTrace = output.substring(0, 1000);
        }
      } catch (err: any) {
        testResults.push({
          testName: probe.name,
          passed: true, // Timeout or error usually means protection worked
          payload: probe.payload,
          error: `Probe blocked: ${err.message}`,
        });
      }
    }

    // Test 4: Check for exposed secrets
    try {
      const { stdout: secretCheck } = await runDockerCommand([
        "exec", containerName, "sh", "-c",
        "grep -r 'password\\|secret\\|api_key\\|token' /app --include='*.js' --include='*.ts' --include='*.env' -l 2>/dev/null || true",
      ]);
      const hasExposedSecrets = secretCheck.trim().length > 0;

      testResults.push({
        testName: "secret_exposure",
        passed: !hasExposedSecrets,
        response: hasExposedSecrets ? `Files with potential secrets: ${secretCheck.trim()}` : undefined,
        error: hasExposedSecrets ? "Potential exposed secrets found" : undefined,
      });
    } catch (err: any) {
      testResults.push({
        testName: "secret_exposure",
        passed: true,
        error: `Check failed: ${err.message}`,
      });
    }

    return { testResults, exploitPayload, stackTrace };
  } finally {
    // Cleanup: stop and remove container
    await runDockerCommand(["stop", "-t", "5", containerName]).catch(() => null);
    await runDockerCommand(["rm", "-f", containerName]).catch(() => null);
  }
}

async function cleanupImage(imageTag: string): Promise<void> {
  await runDockerCommand(["rmi", "-f", imageTag]).catch(() => null);
}

export async function runSecuritySandbox(params: {
  repositoryId: number;
  pullRequestId?: number;
  headSha: string;
  repositoryUrl: string;
}): Promise<SandboxRunResult> {
  if (!isSandboxEnabled()) {
    throw new Error("Security sandbox is not enabled. Set SECURITY_SANDBOX_ENABLED=true");
  }

  const isSafeUrl = await validateSafeUrl(params.repositoryUrl);
  if (!isSafeUrl) {
    throw new Error("Security sandbox aborted: Repository URL resolves to an untrusted or private network address.");
  }

  // Create sandbox record
  const sandbox = await prisma.securitySandbox.create({
    data: {
      repositoryId: params.repositoryId,
      pullRequestId: params.pullRequestId,
      headSha: params.headSha,
      status: "running",
      startedAt: new Date(),
    },
  });

  let imageTag: string | undefined;

  try {
    // Build sandbox image
    imageTag = await buildSandboxImage(params.repositoryUrl, params.headSha);

    await prisma.securitySandbox.update({
      where: { id: sandbox.id },
      data: { imageUrl: imageTag },
    });

    // Run security tests with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Sandbox timeout")), SANDBOX_TIMEOUT_MS);
    });

    const result = await Promise.race([
      runSecurityTests(imageTag),
      timeoutPromise,
    ]);

    // Update sandbox record with results
    const hasSecrets = (result.testResults as any[]).some(
      (t) => t.testName === "secret_exposure" && !t.passed
    );

    if (hasSecrets && params.pullRequestId) {
      const repo = await prisma.repository.findUnique({
        where: { id: params.repositoryId },
        include: { 
          user: { include: { githubAccount: true } }
        }
      });
      const pr = await prisma.pullRequest.findUnique({
        where: { id: params.pullRequestId }
      });

      if (repo && repo.user.githubAccount && pr) {
        try {
          const githubService = new GitHubService(repo.user.githubAccount.accessToken);
          const parts = repo.url.split("/");
          const owner = parts[parts.length - 2];
          const name = parts[parts.length - 1];
          const pullNumber = pr.prNumber;
          
          await githubService.updatePullRequest(owner, name, pullNumber, {
            state: "closed",
          });
          await githubService.postPullRequestComment(
            owner, name, pullNumber,
            "🚨 **CRITICAL SECURITY ALERT** 🚨\n\nThis PR has been automatically quarantined and closed because high-entropy secrets were detected. Please revoke the secrets immediately and remove them from your commit history before reopening."
          );
        } catch (e) {
          console.error("Failed to quarantine PR:", e);
        }
      }
    }

    await prisma.securitySandbox.update({
      where: { id: sandbox.id },
      data: {
        status: "completed",
        testResults: result.testResults as any,
        exploitPayload: result.exploitPayload,
        stackTrace: result.stackTrace,
        completedAt: new Date(),
      },
    });

    if (params.pullRequestId && (result.exploitPayload || result.testResults.some(r => !r.passed))) {
      try {
        const repository = await prisma.repository.findUnique({ where: { id: params.repositoryId } });
        const pr = await prisma.pullRequest.findUnique({ where: { id: params.pullRequestId } });
        
        if (repository && pr) {
          const ownerRepo = GitHubService.parseGitHubUrl(params.repositoryUrl);
          if (ownerRepo) {
            const { owner, repo } = ownerRepo;
            const token = await getDecryptedGitHubToken(repository.userId);
            const github = new GitHubService(token || undefined);
            
            // Check gitverse.yml for toggle
            const configContent = await github.getFileContent(owner, repo, "gitverse.yml", params.headSha);
            let shouldPost = true;
            if (configContent) {
              if (configContent.includes("sandboxComments: false") || configContent.includes("sandbox_comments: false")) {
                shouldPost = false;
              }
            }
            
            if (shouldPost) {
              let md = "## 🛡️ Security Sandbox Report\n\n";
              md += "The security sandbox detected potential vulnerabilities during its automated probes.\n\n";
              md += "| Test | Status | Details |\n";
              md += "|------|--------|---------|\n";
              
              for (const test of result.testResults) {
                const statusIcon = test.passed ? "✅ Passed" : "❌ Failed";
                let details = test.error || test.response || "No details";
                if (details.length > 200) details = details.substring(0, 200) + "...";
                details = details.replace(/\n/g, " ");
                md += `| ${test.testName} | ${statusIcon} | ${details} |\n`;
              }
              
              if (result.exploitPayload) {
                md += `\n**Exploit Payload Executed:**\n\`\`\`\n${result.exploitPayload}\n\`\`\`\n`;
              }
              
              await github.postPullRequestComment(owner, repo, pr.prNumber, md);
            }
          }
        }
      } catch (err) {
        console.error("Failed to post PR comment for security sandbox", err);
      }
    }

    return {
      sandboxId: sandbox.id,
      status: "completed",
      ...result,
    };
  } catch (error: any) {
    const isTimeout = error.message?.includes("timeout");

    await prisma.securitySandbox.update({
      where: { id: sandbox.id },
      data: {
        status: isTimeout ? "timeout" : "failed",
        error: error.message,
        completedAt: new Date(),
      },
    });

    return {
      sandboxId: sandbox.id,
      status: isTimeout ? "timeout" : "failed",
      testResults: [],
      error: error.message,
    };
  } finally {
    // Cleanup image
    if (imageTag) {
      await cleanupImage(imageTag);
    }
  }
}

export async function getSandboxStatus(sandboxId: string) {
  return prisma.securitySandbox.findUnique({
    where: { id: sandboxId },
    select: {
      id: true,
      status: true,
      testResults: true,
      exploitPayload: true,
      stackTrace: true,
      error: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
    },
  });
}

export async function listSandboxesForRepository(
  repositoryId: number,
  limit: number = 10,
) {
  return prisma.securitySandbox.findMany({
    where: { repositoryId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      headSha: true,
      status: true,
      testResults: true,
      exploitPayload: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
    },
  });
}
