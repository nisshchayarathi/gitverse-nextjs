type WorkflowDispatchConfig = {
  repository: string;
  token: string;
  workflowFile?: string;
  ref?: string;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function parseRepositorySlug(repository: string): { owner: string; repo: string } {
  const parts = repository.split("/").filter(Boolean);
  if (parts.length !== 2) {
    throw new Error("GITHUB_WORKFLOW_REPOSITORY must be in the form owner/repo");
  }

  const [owner, repo] = parts;
  return { owner, repo };
}

export async function triggerAnalysisWorkerWorkflow(
  config?: Partial<WorkflowDispatchConfig>,
): Promise<void> {
  const repository = config?.repository || getRequiredEnv("GITHUB_WORKFLOW_REPOSITORY");
  const token = config?.token || getRequiredEnv("GITHUB_WORKFLOW_TOKEN");
  const workflowFile =
    config?.workflowFile || process.env.GITHUB_WORKFLOW_FILE || "run-analysis-cron.yml";
  const ref = config?.ref || process.env.GITHUB_WORKFLOW_REF || "main";

  const { owner, repo } = parseRepositorySlug(repository);

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "GitVerse-App",
      },
      body: JSON.stringify({ ref }),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Failed to dispatch analysis workflow (${response.status}): ${text || response.statusText}`,
    );
  }
}
