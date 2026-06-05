# Cron Runner Setup

GitVerse uses a polling-based analysis job system. When a repository is queued for analysis, a runner must claim and process the job. This document explains how to configure that runner for different environments.

---

## How It Works

1. An API route (e.g. `POST /api/repositories/[id]/analyze`) enqueues an `AnalysisJob` in the database.
2. A runner calls `POST /api/internal/run-analysis` to claim and process one pending job.
3. Progress is written to the `analysis_jobs` table and polled via `GET /api/analysis-jobs/[id]`.

The endpoint `/api/internal/run-analysis` only supports `POST`.
All requests require `ANALYSIS_RUNNER_SECRET` in production. The secret is passed exclusively via the `x-analysis-runner-secret` HTTP header. Query string authentication is not supported to prevent credential leakage in access logs, proxy logs, and browser history.

---

## Option A: Vercel Cron Jobs (Recommended for Vercel deployments)

Vercel's built-in cron scheduler triggers your serverless function on a schedule — no separate worker process, no `git clone` required.

### 1. Add the cron to `vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/internal/run-analysis",
      "schedule": "* * * * *"
    }
  ],
  "functions": {
    "app/api/internal/run-analysis/route.ts": {
      "maxDuration": 300
    }
  }
}
```

### 2. Set environment variables in Vercel

In **Vercel Dashboard → Settings → Environment Variables**, add:

| Variable | Description |
|---|---|
| `ANALYSIS_RUNNER_SECRET` | Required. Generate with `openssl rand -hex 32`. The endpoint will reject all requests if this is not set in production. |
| `CRON_SECRET` | Optional. Set to match `ANALYSIS_RUNNER_SECRET` so Vercel Cron injections authenticate correctly. |

### How authentication works

Vercel cron triggers send a `GET` request with the `User-Agent: vercel-cron/1.0` header. The endpoint authenticates using `ANALYSIS_RUNNER_SECRET` from the environment. Set `CRON_SECRET` to the same value as `ANALYSIS_RUNNER_SECRET` for Vercel Cron compatibility.

For manual or scripted calls:
```bash
curl -X POST https://your-app.vercel.app/api/internal/run-analysis \
  -H "x-analysis-runner-secret: YOUR_SECRET"
```

### Error handling

| Scenario | Behaviour |
|---|---|
| No pending jobs | Returns `204 No Content` |
| Job processing fails | Returns 500; job re-queued until max attempts, then FAILED |
| Unauthorized request | Returns `401 Unauthorized` |
| Secret not configured | Returns `500` with `SECRET_MISSING` code |
| Rate limited | Returns `429` |

---

## Option B: GitHub Actions Cron (Free alternative)

If you are not on Vercel Pro, or you want a free scheduler, use the included GitHub Actions workflow. It runs every 5 minutes, checks out the repo, builds the worker, and runs it once.

### 1. The workflow file

The workflow is already included at `.github/workflows/run-analysis-cron.yml`:

```yaml
name: Run Analysis Worker
on:
  schedule:
    - cron: '*/5 * * * *'
  workflow_dispatch:
jobs:
  run-worker:
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      ANALYSIS_RUNNER_SECRET: ${{ secrets.ANALYSIS_RUNNER_SECRET }}
      GITHUB_APP_PRIVATE_KEY: ${{ secrets.GITHUB_APP_PRIVATE_KEY }}
      GITHUB_APP_ID: ${{ secrets.GITHUB_APP_ID }}
      GITHUB_APP_SLUG: ${{ secrets.GITHUB_APP_SLUG }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npx prisma generate --schema "$GITHUB_WORKSPACE/prisma/schema.prisma"
      - run: npm run build:worker
      - run: WORKER_ONCE=1 node dist-worker/scripts/analysisWorker.js
```

### 2. Add GitHub Actions secrets

In **GitHub → Repository Settings → Secrets and variables → Actions**, add:

| Secret | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `ANALYSIS_RUNNER_SECRET` | Must match the value set in your deployment |
| `GITHUB_APP_PRIVATE_KEY` | Only needed if using GitHub App integration |
| `GITHUB_APP_ID` | Only needed if using GitHub App integration |
| `GITHUB_APP_SLUG` | Only needed if using GitHub App integration |

### 3. Trigger on demand

You can also trigger the worker immediately from another service:

```ts
import { triggerAnalysisWorkerWorkflow } from "@/lib/services/analysisWorkerTriggerService";

await triggerAnalysisWorkerWorkflow();
```

Required environment variables:

| Variable | Description |
|---|---|
| `GITHUB_WORKFLOW_REPOSITORY` | Your repo in `owner/repo` format |
| `GITHUB_WORKFLOW_TOKEN` | A GitHub token with `Actions: write` permission |
| `GITHUB_WORKFLOW_FILE` | Workflow filename — defaults to `run-analysis-cron.yml` |
| `GITHUB_WORKFLOW_REF` | Branch to run on — defaults to `main` |

### Error handling

| Scenario | Behaviour |
|---|---|
| No pending jobs | Worker exits cleanly |
| Job fails | Re-queued until retries exhausted; then FAILED |
| Missing secrets | `getRequiredEnv` throws with the variable name |

---

## Option C: Self-hosted / Docker

If you are running GitVerse on a VPS or with Docker, use the long-running worker process:

```bash
npm run build:worker
npm run worker
WORKER_ONCE=1 node dist-worker/scripts/analysisWorker.js
```

---

## Calling the endpoint manually

```bash
curl -X POST https://your-app.vercel.app/api/internal/run-analysis \
  -H "x-analysis-runner-secret: YOUR_SECRET"
```

The secret must be passed via `x-analysis-runner-secret` header. Query string authentication is not supported.

---

## Environment variable reference

| Variable | Required | Description |
|---|---|---|
| `ANALYSIS_RUNNER_SECRET` | Yes (production) | Secures `/api/internal/run-analysis`. Generate with `openssl rand -hex 32`. |
| `CRON_SECRET` | Optional | For Vercel Cron compatibility. Set to match `ANALYSIS_RUNNER_SECRET`. |
| `GITHUB_WORKFLOW_REPOSITORY` | Option B only | Repo to dispatch workflow on |
| `GITHUB_WORKFLOW_TOKEN` | Option B only | GitHub token with `Actions: write` |
| `GITHUB_WORKFLOW_FILE` | Option B only | Defaults to `run-analysis-cron.yml` |
| `GITHUB_WORKFLOW_REF` | Option B only | Defaults to `main` |

---

## Choosing the right option

| | Vercel Cron | GitHub Actions | Self-hosted |
|---|---|---|---|
| Requires Vercel Pro | ✅ Yes | ❌ No | ❌ No |
| Free | ❌ | ✅ (within GHA limits) | ✅ |
| Minimum interval | 1 minute | 5 minutes | Any |
| Best for | Vercel Pro deployments | Vercel Hobby / GitHub-hosted | Docker / VPS |
