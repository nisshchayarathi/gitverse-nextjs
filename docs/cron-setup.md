# Cron Runner Setup

GitVerse uses a background analysis worker to process repository analysis jobs from a database queue. This document explains how the worker runs, how to configure it, and how to set it up on each deployment target.

---

## How it works

```
User triggers analysis
        │
        ▼
POST /api/repositories/[id]/analyze
        │  creates an AnalysisJob row (status: QUEUED)
        ▼
    Database queue
        │
        ▼
  Analysis worker  ◄──── cron / GitHub Actions / Vercel Cron
        │  claims job, runs git clone + analysis, updates status
        ▼
  Job status: DONE / FAILED
        │
        ▼
GET /api/analysis-jobs/[id]  (polled by the frontend)
```

The worker is a **one-shot loop**: it claims the next queued job, runs it to completion, then exits. The cron trigger calls it on a schedule so jobs are picked up continuously.

---

## Environment variables

Add these to `.env.local` (local dev) or your deployment platform's secret store.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string. The worker reads/writes jobs directly. |
| `ANALYSIS_RUNNER_SECRET` | ✅ (production) | Bearer token that protects `GET /api/internal/run-analysis`. Generate with `openssl rand -hex 32`. |
| `GITHUB_APP_ID` | ✅ (if using GitHub App) | Numeric ID of your GitHub App. |
| `GITHUB_APP_PRIVATE_KEY` | ✅ (if using GitHub App) | RSA private key for GitHub App auth. Store with literal `\n` line breaks. |
| `GITHUB_APP_SLUG` | optional | URL slug of your GitHub App. |
| `WORKER_ID` | optional | Custom worker identifier for log tracing. Defaults to `hostname-pid-random`. |
| `WORKER_ONCE` | optional | Set to `1` to run one pass and exit (used by the GitHub Actions workflow). |

> **Never commit `ANALYSIS_RUNNER_SECRET` to source control.** Treat it like a password.

---

## Deployment options

### Option A — Vercel Cron Jobs (recommended for Vercel deployments)

Vercel Cron Jobs call an HTTP endpoint on a schedule. The endpoint is already implemented at `GET /api/internal/run-analysis`.

**1. Add `vercel.json` to the project root** (create it if it doesn't exist):

```json
{
  "crons": [
    {
      "path": "/api/internal/run-analysis",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

This calls the endpoint every 5 minutes. Adjust the schedule as needed — see [cron expression syntax](#cron-expression-reference).

**2. Set the secret in the Vercel dashboard:**

Go to **Project → Settings → Environment Variables** and add:

```
ANALYSIS_RUNNER_SECRET = <your-secret>
```

**3. Deploy:**

```bash
git add vercel.json
git commit -m "chore: add Vercel cron for analysis worker"
git push
```

Vercel automatically picks up the `crons` config on the next deployment.

**How the endpoint is protected:**

The route checks the `Authorization` header:

```
Authorization: Bearer <ANALYSIS_RUNNER_SECRET>
```

Vercel Cron Jobs do **not** send this header automatically — Vercel instead uses its own OIDC token. To verify the request comes from Vercel, check the `x-vercel-signature` header or restrict the route to Vercel's IP ranges. For most projects, setting a strong `ANALYSIS_RUNNER_SECRET` and keeping it out of source control is sufficient.

If you want to verify the Vercel OIDC token instead, see the [Vercel Cron Jobs documentation](https://vercel.com/docs/cron-jobs).

---

### Option B — GitHub Actions (recommended for open-source / free tier)

The workflow at `.github/workflows/run-analysis-cron.yml` already exists and runs every 5 minutes.

**1. Add GitHub Actions secrets:**

Go to **Repository → Settings → Secrets and variables → Actions** and add:

| Secret name | Value |
|---|---|
| `DATABASE_URL` | Your PostgreSQL connection string |
| `ANALYSIS_RUNNER_SECRET` | Same secret as your deployment |
| `GITHUB_APP_PRIVATE_KEY` | RSA private key (if using GitHub App) |
| `GITHUB_APP_ID` | GitHub App numeric ID (if using GitHub App) |
| `GITHUB_APP_SLUG` | GitHub App slug (if using GitHub App) |

**2. The workflow runs automatically** on the schedule defined in the YAML:

```yaml
on:
  schedule:
    - cron: '*/5 * * * *'   # every 5 minutes
  workflow_dispatch:          # also triggerable manually
```

**3. Trigger manually** (useful for testing):

Go to **Actions → Run Analysis Worker → Run workflow**.

**How it works:**

The workflow checks out the repo, installs dependencies, compiles the worker (`npm run build:worker`), then runs:

```bash
WORKER_ONCE=1 node dist-worker/scripts/analysisWorker.js
```

`WORKER_ONCE=1` makes the worker process one job and exit, which fits the GitHub Actions execution model.

---

### Option C — Long-running worker server (Docker / VPS / Cloud Run)

For self-hosted deployments where you want a persistent worker process rather than a cron trigger, use the worker server:

```bash
# Build the worker
npm run build:worker

# Start the worker server (runs indefinitely, polls for jobs)
npm run worker:server
```

The worker server exposes:

| Endpoint | Method | Description |
|---|---|---|
| `/` or `/healthz` | `GET` | Health check — returns `ok` |
| `/readyz` | `GET` | Readiness check — returns `ok` |
| `/run` | `POST` | Trigger a worker pass programmatically |

**Trigger a one-shot run via the worker server:**

```bash
curl -X POST http://localhost:8080/run \
  -H "Content-Type: application/json" \
  -d '{"once": true}'
```

**Docker Compose example:**

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file: .env

  worker:
    build: .
    command: node dist-worker/scripts/workerServer.js
    env_file: .env
    depends_on:
      - app
```

---

### Option D — Local development

For local development you generally don't need the cron runner — you can trigger analysis manually from the UI. If you want to test the worker locally:

```bash
# Run one pass (processes one queued job and exits)
WORKER_ONCE=1 npm run worker:dev

# Run continuously (polls every 2 seconds)
npm run worker:dev
```

`npm run worker:dev` uses `tsx` to run the TypeScript source directly without a build step.

---

## API route reference

### `GET /api/internal/run-analysis`

Triggers one pass of the analysis worker. Called by the cron scheduler.

**Authentication:** `Authorization: Bearer <ANALYSIS_RUNNER_SECRET>`

If `ANALYSIS_RUNNER_SECRET` is not set in the environment, the route runs without auth (useful for local dev — set the secret in production).

**Response (200):**

```json
{
  "success": true,
  "message": "Analysis worker execution completed",
  "metrics": {
    "totalJobsScanned": 1,
    "jobsProcessed": 1,
    "jobsSkipped": 0,
    "jobsFailed": 0,
    "executionDurationMs": 4821,
    "success": true
  }
}
```

**Response (401):** Missing or invalid `ANALYSIS_RUNNER_SECRET`.

**Response (500):** Worker threw an unexpected error — check server logs.

### `GET /api/analysis-jobs/[id]`

Poll the status of a specific analysis job. Used by the frontend to show progress.

**Authentication:** Requires a valid user session (JWT or NextAuth cookie).

**Response:**

```json
{
  "job": {
    "id": "uuid",
    "status": "PROCESSING",
    "progressPercent": 45,
    "progressMessage": "Analyzing commits",
    "repositoryId": 7,
    "attempts": 1,
    "maxAttempts": 3,
    "startedAt": "2026-05-22T10:00:00.000Z",
    "finishedAt": null,
    "error": null
  }
}
```

**Job statuses:**

| Status | Meaning |
|---|---|
| `QUEUED` | Waiting to be picked up by the worker |
| `PROCESSING` | Worker is actively running the job |
| `DONE` | Analysis completed successfully |
| `FAILED` | All retry attempts exhausted |

---

## Cron expression reference

```
┌─────────── minute (0–59)
│ ┌───────── hour (0–23)
│ │ ┌─────── day of month (1–31)
│ │ │ ┌───── month (1–12)
│ │ │ │ ┌─── day of week (0–6, Sunday = 0)
│ │ │ │ │
* * * * *
```

| Expression | Meaning |
|---|---|
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour (on the hour) |
| `0 */6 * * *` | Every 6 hours |
| `0 2 * * *` | Daily at 02:00 UTC |
| `0 2 * * 0` | Weekly on Sunday at 02:00 UTC |

> **Note:** GitHub Actions has a minimum schedule interval of 5 minutes. Vercel Cron Jobs support down to 1 minute on Pro plans.

---

## Troubleshooting

### Worker exits immediately with no jobs processed

The queue is empty — no analysis jobs are pending. Trigger an analysis from the UI or via:

```bash
curl -X POST /api/repositories/<id>/analyze \
  -H "Authorization: Bearer <your-jwt>"
```

### `401 Unauthorized` from `/api/internal/run-analysis`

The `Authorization` header is missing or the secret doesn't match. Verify:

1. `ANALYSIS_RUNNER_SECRET` is set in your deployment environment.
2. The cron caller is sending `Authorization: Bearer <secret>`.
3. The secret value matches exactly (no trailing whitespace or newline).

### Job stuck in `PROCESSING` / lock not released

The worker holds a 5-minute lock on each job. If the worker crashes mid-job, the lock expires automatically and the job is re-queued. You can also manually reset a stuck job in Prisma Studio:

```bash
npm run prisma:studio
```

Find the job in the `AnalysisJob` table and set `status` back to `QUEUED`, clear `lockedAt`, `lockedBy`, and `lockExpiresAt`.

### Job keeps retrying and failing

Check the `error` field on the job (visible in Prisma Studio or via `GET /api/analysis-jobs/[id]`). Common causes:

- **Repository URL unreachable** — the URL is private or the server has no outbound internet access.
- **Git clone timeout** — large repositories may exceed the worker's execution window. Consider increasing `maxDuration` in the route or using the long-running worker server instead.
- **Rate limited by GitHub** — the job will back off automatically and retry. The `retryAfter` field on the job response shows when the next attempt is scheduled.
- **Missing `GITHUB_APP_PRIVATE_KEY`** — required for private repositories accessed via the GitHub App.

### GitHub Actions workflow not triggering

- GitHub Actions schedules can be delayed by up to 15 minutes during high load.
- Workflows on inactive repositories (no pushes in 60 days) are automatically disabled. Re-enable them from the **Actions** tab.
- Check that all required secrets are set under **Repository → Settings → Secrets**.

### Vercel Cron Job not running

- Cron Jobs require a **Vercel Pro** plan or higher for schedules more frequent than daily.
- Check the **Vercel dashboard → Project → Cron Jobs** tab to see execution history and errors.
- Ensure `vercel.json` is committed and the deployment is up to date.

### `DATABASE_URL` not available in the worker

The worker reads `DATABASE_URL` at startup via `dotenv/config`. For local dev, ensure `.env` (not just `.env.local`) contains the variable:

```bash
cp .env.local .env
```

For GitHub Actions, add `DATABASE_URL` as a repository secret. For Vercel, add it as an environment variable in the dashboard.

---

## Security notes

- **Protect `/api/internal/run-analysis`** with a strong `ANALYSIS_RUNNER_SECRET` in all non-local environments. Anyone who can call this endpoint can trigger repository cloning and analysis.
- **Rotate the secret** if it is ever exposed. Update it in your deployment environment and in GitHub Actions secrets simultaneously.
- The worker runs `git clone` on user-supplied URLs. Ensure your deployment environment's network egress policy allows outbound HTTPS to GitHub/GitLab/Bitbucket.
- Job errors are sanitized before being stored — raw stack traces and secrets are stripped by `sanitizeErrorMessage` before writing to the database.
