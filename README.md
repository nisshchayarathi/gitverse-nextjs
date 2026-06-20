<div align="center">

# GitVerse 🗺️

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Deploy on Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=flat-square&logo=vercel)](https://vercel.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/nisshchayarathi/gitverse-nextjs/pulls)
[![CI: Test Platform](https://github.com/nisshchayarathi/gitverse-nextjs/actions/workflows/test.yml/badge.svg)](https://github.com/nisshchayarathi/gitverse-nextjs/actions/workflows/test.yml)
[![CI: Playwright](https://github.com/nisshchayarathi/gitverse-nextjs/actions/workflows/playwright.yml/badge.svg)](https://github.com/nisshchayarathi/gitverse-nextjs/actions/workflows/playwright.yml)
[![CI: Prisma Schema](https://github.com/nisshchayarathi/gitverse-nextjs/actions/workflows/prisma-check.yml/badge.svg)](https://github.com/nisshchayarathi/gitverse-nextjs/actions/workflows/prisma-check.yml)
[![CI: CodeQL](https://github.com/nisshchayarathi/gitverse-nextjs/actions/workflows/codeql.yml/badge.svg)](https://github.com/nisshchayarathi/gitverse-nextjs/actions/workflows/codeql.yml)
[![CI: Worker Consistency](https://github.com/nisshchayarathi/gitverse-nextjs/actions/workflows/worker-consistency.yml/badge.svg)](https://github.com/nisshchayarathi/gitverse-nextjs/actions/workflows/worker-consistency.yml)

> **Paste a repo. Understand it in minutes.**

GitVerse turns any GitHub repository into an interactive visual map of its architecture, modules, and risk hotspots — so you always know where to start.

Whether you're a new contributor facing an unfamiliar codebase, or a maintainer trying to communicate structure to your team, GitVerse gives you the full picture instantly.

</div>


## 📚 Table of Contents

- [GitVerse](#gitverse-%EF%B8%8F)
- [Pitch](#pitch)
- [“Repo-to-Map in 10 seconds” (MVP flow)](#repo-to-map-in-10-seconds-mvp-flow)
- [What you can do today](#what-you-can-do-today)
- [Supported Node Version](#supported-node-version)
- [Quickstart (local dev)](#️quickstart-local-dev)
- [Contribution-first onboarding ](#contribution-first-onboarding-the-hackathon-angle)
- [Tech stack](#tech-stack)
- [Project Architecture](#%EF%B8%8F-project-architecture)
- [Project Structure](#️%EF%B8%8F-project-structure)
- [Design System](#-design-system)
- [API Routes](#-api-routes)
- [API Pagination](#-api-pagination)
- [Development](-deployment)
- [Security](-security)
- [Environment Variables](-environment-variables)
- [Contributing](-contributing)
- [Contributors & Thanks](#-contributors--thanks)
- [Project Support](#-project-support)
- [License](#-license)
- [Acknowledgments](-acknowledgments)
- [ FAQ – Common Questions & Edge Cases](#--faq--common-questions--edge-cases)


## Pitch

### Problem

Open-source and internal repos are hard to contribute to because context is scattered across folders, commits, and tribal knowledge.

### Why now

Repos are larger, teams are more distributed, and AI can finally summarize + connect the dots fast enough to change the contributor experience.

### Solution

Paste a repo → GitVerse builds a visual map + AI onboarding so contributors can understand architecture and pick a starting point in minutes.

### Impact

- Faster onboarding for new contributors
- Clearer ownership and hotspots
- Better PR quality (less back-and-forth)

## “Repo-to-Map in 10 seconds” (MVP flow)

1. Paste a GitHub URL
2. GitVerse generates:
   - Architecture / module map (visual)
   - Modules + dependencies
   - Top risks / hotspots
   - 3 concrete improvement suggestions
3. Click a module → ask AI: “What does this do?” “Where should I start contributing?”

## What you can do today

- Visualize repository structure and key paths
- Explore commits/branches and contributor activity
- Ask AI questions about files, folders, and architecture
- Generate analysis jobs and track progress

## Supported Node Version

This project officially supports **Node.js 22.x** (as specified in [package.json](package.json)).

## Quickstart (local dev)

```bash
npm install
cp .env.example .env.local
cp .env.local .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Open http://localhost:3000

### Database Seeding

To populate your local database with realistic mock data for testing UI components without manually creating records, run:

```bash
npm run db:seed
```

> **Note:** This command will clear existing data in your local database before generating the new interconnected records (users, repositories, commits, etc.).

## Contribution-first onboarding (the hackathon angle)

GitVerse is designed to make contributing to unfamiliar repos easier:

- “How do I run this project?”
- “Where is auth?”
- “Explain this folder like I’m new.”
- “Give me 3 beginner-friendly issues.”

That’s the MVP: turn repo complexity into a contributor roadmap.

## Tech stack

- Next.js 14 (App Router), React, TypeScript, Tailwind
- Prisma + Postgres (Neon)
- Gemini for AI analysis
- D3/Recharts for visualizations
- Auth: NextAuth (Google) + credentials

## 🏗️ Project Architecture

GitVerse follows a layered architecture with clear separation between the frontend, API layer, service layer, and background processing.

### Frontend Layer (src/)

The React frontend uses the Next.js App Router with client and server components:

- **`src/components/`** — Reusable React components organized by domain: `ai/`, `auth/`, `layout/`, `repository/`, `ui/`, `visualizations/`. UI components use Radix UI primitives and Tailwind CSS for styling
- **`src/contexts/`** — React context providers for auth state, theme, and application settings
- **`src/hooks/`** — Custom React hooks for data fetching, form handling, and UI state
- **`src/utils/`** — Client-side utility functions for formatting, validation, and data transformation

### API Layer (app/api/)

The API follows Next.js Route Handlers, organized by domain module:

- **`app/api/auth/`** — Authentication endpoints: login, signup, logout, sessions, MFA setup and verification
- **`app/api/repositories/`** — Repository CRUD, analysis triggers, stats, file browsing, architecture generation
- **`app/api/ai/`** — AI-powered features: chat, code analysis, PR simulation, repository comparison
- **`app/api/users/`** — User profile management, password changes, avatar uploads
- **`app/api/integrations/`** — Third-party integrations: GitHub OAuth, webhook receiver
- **`app/api/internal/`** — Internal service endpoints: worker health checks, analysis execution, webhook processing
- **`app/api/cron/`** — Scheduled job endpoints: webhook recovery, analysis job cleanup, database backup

### Service Layer (lib/)

The service layer contains all business logic, separated from the API routes:

- **`lib/services/`** — Domain services: `gitService`, `geminiService`, `repositoryService`, `imageService`, `rateLimitService`, `webhookService`, and specialized analysis services
- **`lib/middleware/`** — Express-style middleware for auth, rate limiting, and request validation
- **`lib/utils/`** — Shared utilities: token encryption, auth cookies, cache keys, retry logic, webhook verification
- **`lib/prisma.ts`** — Singleton Prisma client instance with connection pooling for serverless

### Background Worker (scripts/ + dist-worker/)

The background analysis worker runs as a separate process to handle long-running repository analysis without blocking the API:

- **`scripts/analysisWorker.ts`** — Main worker entry point, processes queued analysis jobs from the database
- **`scripts/workerServer.ts`** — HTTP server mode for receiving analysis requests via API
- **`scripts/cronWorker.ts`** — Scheduled job handler that picks up and processes analysis batches
- **`scripts/verify-worker-consistency.ts`** — CI helper that validates worker build integrity

### Data Layer (prisma/)

- **`prisma/schema.prisma`** — Database schema with models for users, repositories, sessions, accounts, analysis jobs, MFA config, and more
- **`prisma/migrations/`** — Database migration history, one directory per migration

### Infrastructure (.github/)

- **`.github/workflows/`** — GitHub Actions CI/CD workflows for testing, security scanning, and GSSoC automation
- **`.github/dependabot.yml`** — Automatic dependency update configuration

## 🏗️ Project Structure

```
gitverse-nextjs/
├── app/
│   ├── api/                 # API routes
│   │   ├── auth/            # Authentication endpoints
│   │   ├── repositories/    # Repository management
│   │   ├── ai/              # AI-powered features
│   │   ├── users/           # User management
│   │   └── integrations/    # Git platform integrations
│   ├── (pages)/             # Page routes
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Home page
├── src/
│   ├── components/          # React components
│   │   ├── ai/              # AI components
│   │   ├── auth/            # Authentication components
│   │   ├── layout/          # Layout components
│   │   ├── repository/      # Repository components
│   │   ├── ui/              # Reusable UI components
│   │   └── visualizations/  # Data visualization components
│   ├── contexts/            # React contexts
│   ├── hooks/               # Custom React hooks
│   ├── pages/               # Page components
│   ├── services/            # API service functions
│   └── utils/               # Utility functions
├── lib/
│   ├── services/            # Backend services
│   │   ├── gitService.ts    # Git operations
│   │   ├── geminiService.ts # AI integration
│   │   └── repositoryService.ts # Repository logic
│   ├── prisma.ts            # Prisma client
│   ├── auth.ts              # Authentication utilities
│   └── middleware.ts        # Auth middleware
├── prisma/
│   └── schema.prisma        # Database schema
├── public/                  # Static assets
└── package.json             # Dependencies
```

### Background Processing Architecture

Repository analysis is computationally expensive and time-consuming. GitVerse uses a background worker pattern to decouple analysis requests from execution:

1. **Request** — A user triggers analysis via the API (`/api/repositories/[id]/analyze`). This creates an `analysis_job` record in the database with status `QUEUED`
2. **Scheduling** — The cron workflow (`run-analysis-cron.yml`) runs every 5 minutes or the worker can be triggered via API (`/api/internal/run-analysis`)
3. **Execution** — The worker picks up queued jobs, sets status to `PROCESSING`, acquires a lock with a 5-minute TTL, and runs the analysis pipeline:
   - Clone the repository (or fetch latest if already cloned)
   - Build the dependency graph
   - Run AI analysis via Gemini
   - Generate architecture summary
   - Store results in the database
4. **Completion** — On success, status moves to `COMPLETED`. On failure, status moves to `FAILED` with error details. If the worker crashes, the lock expires and the job is requeued by the next cron run

### Error Handling Strategy

The application uses a layered error handling approach:

- **API routes** — Wrap handler logic in try/catch blocks. Return structured JSON error responses with appropriate HTTP status codes (400 for validation, 401 for auth, 403 for authorization, 404 for not found, 500 for server errors)
- **Service layer** — Throw typed errors with context. Services catch and wrap low-level errors (database, network, API) into domain-specific errors before propagating
- **Background worker** — Logs errors with context (job ID, repository ID, error stack). Failed jobs store the error message in the database for debugging. Stale locks from crashed workers are cleaned up on the next cron run
- **Middleware** — Auth middleware returns 401 for unauthenticated requests. Rate limit middleware returns 429 when limits are exceeded. Both include descriptive error messages in the response body

## 🎨 Design System

### Color Palette

- **Primary:** Deep Blue (#1E3A8A) - Professional and trustworthy
- **Secondary:** Slate Gray (#475569) - Neutral and sophisticated
- **Accent:** Electric Green (#10B981) - Active elements and success states
- **Supporting:** Orange (#F59E0B) for warnings, Red (#EF4444) for errors

### Typography

- **Headings:** Inter
- **Body:** Source Sans 3
- **Code:** JetBrains Mono

## Development Workflow

The standard development cycle for contributing to GitVerse follows these stages:

1. **Fork and clone** — Fork the upstream repository, clone your fork locally, and add the upstream remote
2. **Create a branch** — Use a descriptive branch name following the branching convention (see CONTRIBUTING.md)
3. **Install dependencies** — Run `npm install` to install all required packages
4. **Set up the database** — Configure your local PostgreSQL or Neon database, set `DATABASE_URL` in `.env.local`, run `npm run prisma:generate` and `npm run prisma:migrate`
5. **Start the dev server** — Run `npm run dev` to start the Next.js development server with hot reload
6. **Make changes** — Edit code, add features, fix bugs. Follow the code style guidelines
7. **Run checks locally** — Execute `npm run lint`, `npm run typecheck`, and `npm test` to verify your changes
8. **Commit** — Write a conventional commit message describing the change
9. **Push and open a PR** — Push your branch to your fork and open a pull request against the upstream `main` branch
10. **Address review feedback** — Respond to reviewer comments, push additional commits as needed

### Branch Naming Convention

Use these prefixes to name your branches:

| Prefix | When to use | Example |
| :----- | :---------- | :------ |
| `feature/` | Adding a new capability or enhancement | `feature/ai-chat-history` |
| `bugfix/` | Fixing a bug or regression | `bugfix/login-error-toast` |
| `fix/` | Short for bugfix | `fix/broken-yaml-test-workflow` |
| `refactor/` | Restructuring code without changing behavior | `refactor/api-response-types` |
| `docs/` | Adding or updating documentation | `docs/contributing-guide` |
| `chore/` | Maintenance, dependency updates, config changes | `chore/upgrade-prisma` |

The branch name should be short but descriptive. Use hyphens to separate words. Avoid generic names like `patch-1` or `fix-bug`.

### Commit Message Format

Use conventional commits for all commit messages:

```
<type>(<scope>): <description>

[optional body explaining why the change was made]
```

Types include: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`.

Examples:
- `feat(ai): add repository analysis progress tracking`
- `fix(auth): handle expired session tokens gracefully`
- `docs(readme): update environment variable table`
- `chore(deps): upgrade prisma to v7`

The body should explain why the change was made, not what changed. The diff already shows what changed. Keep the body focused and concise.

## 🧩 Available Scripts

| Script | Command | Purpose |
| :----- | :------ | :------ |
| `npm run dev` | `next dev` | Start the Next.js development server with hot module replacement. Uses `--dns-result-order=ipv4first` for NeonDB compatibility |
| `npm run build` | `prisma generate && npm run build:worker && next build` | Full production build: generates Prisma client, compiles the background worker, then builds the Next.js application |
| `npm start` | `next start` | Start the production Next.js server. Requires a prior build |
| `npm run lint` | `next lint` | Run ESLint via Next.js. Reports code quality, accessibility, and React best practice violations |
| `npm run typecheck` | `prisma generate && tsc --noEmit` | TypeScript type checking without emitting compiled files. Deletes the tsbuildinfo cache to ensure fresh checking |
| `npm run format` | `prettier --write` | Format all TypeScript, TSX, and CSS files with Prettier. Run before committing |
| `npm run analyze` | `ANALYZE=true next build` | Build with bundle analyzer enabled. Opens a visual report of bundle sizes in the browser |
| `npm test` | `jest` | Run the Jest unit test suite. Use with `--watch` for continuous testing during development |
| `npm run test:e2e` | `playwright test` | Run Playwright end-to-end browser tests. Requires Playwright browsers to be installed first |
| `npm run build:worker` | `tsc -p tsconfig.worker.json` | Compile the background analysis worker from TypeScript sources in `scripts/` and `lib/` into `dist-worker/` |
| `npm run worker` | `node dist-worker/scripts/analysisWorker.js` | Run the analysis worker directly in the foreground. Processes queued analysis jobs |
| `npm run worker:server` | `node dist-worker/scripts/workerServer.js` | Run the worker as an HTTP server, listening for analysis requests |
| `npm run worker:dev` | `tsx watch scripts/analysisWorker.ts` | Run the worker in development mode with file watching and automatic restart |
| `npm run prisma:generate` | `prisma generate` | Generate the Prisma type-safe client from the schema. Run after every schema change |
| `npm run prisma:migrate` | `prisma migrate dev` | Apply pending migrations to the local database. Creates migration files for new schema changes |
| `npm run prisma:studio` | `prisma studio` | Open Prisma Studio web UI for browsing and editing database records |
| `npm run db:seed` | `tsx prisma/seed.ts` | Seed the database with realistic mock data. Clears existing data before inserting new records |
| `npm run test:validation` | `tsx scripts/test-validation.ts` | Run validation scripts for data integrity checks |

## 🔧 API Routes

All API routes are available under `/api`:

- `/api/auth/*` - Authentication (login, signup, logout, me)
- `/api/repositories` - Repository CRUD operations
- `/api/repositories/[id]` - Specific repository operations
- `/api/repositories/[id]/stats` - Repository statistics
- `/api/repositories/[id]/analyze` - Trigger repository analysis
- `/api/ai/analyze-repository` - AI repository analysis
- `/api/ai/analyze-code` - AI code analysis
- `/api/ai/chat` - AI chat interface
- `/api/users/profile` - User profile management
- `/api/integrations/*` - Git platform integrations

## 📑 API Pagination

To ensure consistent performance and predictability, paginated API endpoints in GitVerse use **cursor-based pagination** instead of traditional offset pagination.

### Query Parameters

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `limit` | `number` | `10` | The maximum number of items to return (clamped to max `50` for safety). |
| `cursor`| `string` | `null` | The ID of the last item received in the previous page. Omit for the first page. |

### Example Request

```bash
GET /api/auth/sessions?limit=20&cursor=clq123abc
```

### Standard Response Format

All paginated endpoints return an object containing an `items` array and a `nextCursor` string. If `nextCursor` is present, it indicates there is more data available.

```json
{
  "items": [
    { "id": "clq123abd", "expires": "2026-05-21T00:00:00.000Z" },
    { "id": "clq123abe", "expires": "2026-05-20T00:00:00.000Z" }
  ],
  "nextCursor": "clq123abf"
}
```

### Frontend Consumption Best Practices

When fetching data in the UI (e.g., via infinite scrolling or "Load More" buttons), keep track of the `nextCursor` and pass it to subsequent requests. Avoid duplicate fetches by ensuring UI loading states block concurrent requests.

```javascript
const loadMore = async () => {
  if (!nextCursor || isLoading) return;
  setIsLoading(true);
  
  try {
    const res = await fetch(`/api/auth/sessions?limit=20&cursor=${nextCursor}`);
    const data = await res.json();
    
    setItems((prev) => [...prev, ...data.items]);
    setNextCursor(data.nextCursor);
  } finally {
    setIsLoading(false);
  }
};
```

## 🚀 Deployment

### Vercel (Recommended)

#### Environment Variables Checklist

Before deploying, add these in **Vercel Dashboard → Project → Settings → 
Environment Variables:**

| Variable | Required | Description | Example |
|---|---|---|---|
| `DATABASE_URL` |  Yes | PostgreSQL connection string (Neon recommended) | `postgresql://user:pass@host/db` |
| `JWT_SECRET` | Yes | Secret key for JWT signing | `openssl rand -base64 32` |
| `NEXTAUTH_URL` |  Yes | Your deployed Vercel URL | `https://your-app.vercel.app` |
| `NEXTAUTH_SECRET` |  Yes | NextAuth session signing secret | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` |  No (required for OAuth) | Google OAuth client ID | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` |  No (required for OAuth) | Google OAuth client secret | From Google Cloud Console |
| `NEXT_PUBLIC_API_URL` |  Optional | API URL for client-side calls | Defaults to current domain |

#### 🚀 Deployment Steps:

1. Push your code to GitHub.
2. Import the project in the [Vercel dashboard](https://vercel.com/new).
3. Under **Settings → Environment Variables**, add every variable listed in the [Environment Variables](#-environment-variables) section below. Vercel automatically makes them available at build time and runtime.
   - For `NEXTAUTH_URL`, set the value to your Vercel deployment URL (e.g. `https://gitverse.vercel.app`). In local development, set it to `http://localhost:3000` in your `.env.local` to avoid missing-URL warnings.
   - Mark sensitive secrets (e.g. `JWT_SECRET`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`) as **Sensitive** in Vercel so they are never exposed in logs.
4. Click **Deploy**.

> **Tip:** Vercel re-deploys automatically on every push to `main`. If you update an environment variable in the dashboard, trigger a redeploy from **Deployments → Redeploy** for the new value to take effect.
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) then **Import Project**
3. Select your GitHub repository
4. Add all required environment variables from the checklist above
5. Click **Deploy**
6. In Google Cloud Console, add your Vercel URL as an OAuth redirect URI

#### 🔧 Troubleshooting

**Build failing on Vercel?**
- Ensure all required environment variables are set
- Check build logs under **Vercel Dashboard → Deployments → Build Logs**

**Database connection errors?**
- Verify `DATABASE_URL` is a valid PostgreSQL connection string
- If using Neon, make sure the database is not paused
- Neon free tier pauses after inactivity — wake it up from the Neon dashboard

**Google OAuth not working?**
- Ensure `NEXTAUTH_URL` exactly matches your Vercel deployment URL
- Add `https://your-app.vercel.app/api/auth/callback/google` 
  to **Authorized Redirect URIs** in Google Cloud Console
- Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correctly copied

**AI analysis not working?**
- Verify `GEMINI_API_KEY` is valid and has not exceeded quota
- Check [Google AI Studio](https://aistudio.google.com) for API usage limits

**Environment variables not updating?**
- After changing env vars in Vercel dashboard, trigger a **Redeploy** manually
- Vercel does not auto-redeploy when env vars change
1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

#### ✅ Vercel Environment Variables Checklist

Add these in **Vercel Dashboard → Settings → Environment Variables**:

| Variable | Required | When needed |
|---|---|---|
| `DATABASE_URL` | ✅ Always | PostgreSQL connection string (use NeonDB pooler URL) |
| `NEXTAUTH_SECRET` | ✅ Always | Session encryption — generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ Always | Your production domain e.g. `https://your-app.vercel.app` |
| `GEMINI_API_KEY` | ✅ Always | Google Gemini AI — get from [aistudio.google.com](https://aistudio.google.com) |
| `JWT_SECRET` | ✅ Always | JWT signing secret |
| `GOOGLE_CLIENT_ID` | ⚡ OAuth | Only if using Google login |
| `GOOGLE_CLIENT_SECRET` | ⚡ OAuth | Only if using Google login |
| `GITHUB_APP_ID` | ⚡ PR Reviews | Only if using GitHub App integration |
| `GITHUB_APP_PRIVATE_KEY` | ⚡ PR Reviews | Only if using GitHub App integration |
| `GITHUB_WEBHOOK_SECRET` | ⚡ PR Reviews | Only if using GitHub webhooks |
| `ANALYSIS_RUNNER_SECRET` | ✅ Always | Required in production. Protects `/api/internal/run-analysis`. Generate with `openssl rand -hex 32`. Must NOT be passed via query string. |
| `GITVERSE_ANALYSIS_BACKEND` | ⚡ Cron | URL of your analysis worker backend |
| `SMTP_HOST` | ⚡ Email | Only if using password reset emails |
| `SMTP_USER` | ⚡ Email | Only if using password reset emails |
| `SMTP_PASS` | ⚡ Email | Only if using password reset emails |

#### ⚠️ Common Vercel Deployment Mistakes

- **Wrong DATABASE_URL** — Use the **pooler** URL from NeonDB for Vercel (not direct connection)
- **Missing NEXTAUTH_URL** — Must be set to your exact production domain
- **GITHUB_APP_PRIVATE_KEY format** — Paste with literal `\n` between lines, wrapped in quotes
- **ANALYSIS_RUNNER_SECRET not set** - Required in production; `/api/internal/run-analysis` rejects requests with 500 until the secret is configured. Generate with `openssl rand -hex 32`. Never pass the secret via query string.

### Docker

```bash
docker build -t gitverse-nextjs .
docker run -p 3000:3000 gitverse-nextjs
```

### Firebase App Hosting (Cloud Run)

This repo includes App Hosting config in `apphosting.yaml`.

1. Create Secret Manager entries (names must match `apphosting.yaml`):

```bash
firebase apphosting:secrets:set webapp-firebase-api-key
firebase apphosting:secrets:set gemini-api-key
firebase apphosting:secrets:set database-url
firebase apphosting:secrets:set jwt-secret

firebase apphosting:secrets:set nextauth-url
firebase apphosting:secrets:set nextauth-secret
firebase apphosting:secrets:set google-client-id
firebase apphosting:secrets:set google-client-secret
```

2. Deploy:

```bash
firebase deploy
```

3. In Google Cloud Console (OAuth client), add redirect URI:

- `https://<your-domain>/api/auth/callback/google`

## 🔒 Security

GitVerse implements several security layers to protect users and infrastructure. The security architecture follows the principle of defense in depth — multiple independent checks at different layers prevent a single vulnerability from compromising the system.

### Threat Model

The main security threats GitVerse defends against are:
- **SSRF (Server-Side Request Forgery)**: Attackers supplying URLs that point to internal services, cloud metadata endpoints, or restricted network ranges
- **Unauthorized access**: Unauthenticated users accessing protected endpoints or another user's data
- **Malicious file uploads**: Attackers uploading non-image files or oversized payloads through avatar upload
- **Rate limit bypass**: Attackers flooding endpoints to exhaust server resources
- **Credential leakage**: Secrets exposed through error messages, logs, or client-side code

### Server-Side Request Forgery (SSRF) Protection

SSRF attacks let attackers trick a server into making requests to internal services, cloud metadata endpoints, or other restricted resources. GitVerse uses DNS-level validation to block these attacks.

**Where SSRF validation is applied:**
- Avatar HTTP URL uploads (`/api/upload/avatar`) — validated via `validateHttpAvatarUrl` which calls `validateSafeUrl` from `lib/utils/ssrfValidator.ts`
- Repository URL validation — the same `validateSafeUrl` utility is used to check repository URLs before cloning

**How it works:**

The `validateSafeUrl` function performs these steps:
1. Parses the URL to extract the hostname
2. Rejects non-HTTP/HTTPS protocols immediately
3. Resolves the hostname via `dns.lookup` to get all IP addresses (both IPv4 and IPv6)
4. Checks every resolved address against private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16, 0.0.0.0/8)
5. Checks against IPv6 private ranges (::1, fc00::/7, fe80::/10)
6. If any resolved IP falls into a restricted range, the URL is rejected
7. If DNS resolution fails (NXDOMAIN, timeout, network error), the URL is considered unsafe and rejected

**Why format-only checks are insufficient:**

A naive URL validator that only checks `protocol + hostname.includes(".")` can be bypassed trivially:
- `http://169.254.169.254/latest/meta-data/` has a valid protocol, hostname with dots, but points to the AWS metadata service
- `http://10.0.0.1/admin` passes format checks but targets an internal RFC 1918 address
- `http://127.0.0.1:3000/api/admin/dlq` passes format checks but targets a local web server
- An attacker-controlled domain like `internal-proxy.evil.com` could resolve to an internal IP via DNS rebinding

**Avatar upload validation flow:**

```
User submits HTTP URL → validateHttpAvatarUrl()
  → Check protocol is http: or https:
  → Check hostname exists and contains a dot
  → validateSafeUrl() → dns.lookup(hostname)
    → All IPs public? → Accept URL
    → Any IP private? → Reject with "restricted address"
```

### Authentication and Authorization

- **Session validation**: All API routes that handle user data use `requireAuth` middleware to validate sessions
- **Resource ownership**: Users can only access their own data (repositories, profiles, sessions)
- **Rate limiting**: Sensitive endpoints enforce per-user rate limits to prevent abuse

### Input Validation

- **File uploads**: Avatar files are validated for MIME type (JPEG, PNG, WebP, GIF only) and size (max 500KB)
- **Data URLs**: Base64 image data is validated for content type, decoded server-side, and stored on disk
- **JSON bodies**: All API routes that accept JSON validate fields before processing
- **URLs**: HTTP/HTTPS URLs are validated against SSRF vectors before storage

### Secrets Management

- All credentials use environment variables, never hardcoded values
- Secrets are marked as sensitive in deployment environments
- Environment variable validation runs during CI to catch missing values
- Token encryption keys are stored as hex-encoded strings and used for encrypting OAuth tokens at rest

## 📝 Environment Variables

Required:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret. The app will crash on startup without it.
- `GEMINI_API_KEY` - Google Gemini API key

OAuth (Google / NextAuth):

- `NEXTAUTH_URL` - Deployed base URL (e.g. `https://<your-domain>`)
- `NEXTAUTH_SECRET` - Session/JWT signing secret (generate with `openssl rand -base64 32`)
- `GOOGLE_CLIENT_ID` - Google OAuth client id (required only if Google sign-in is enabled)
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret (required only if Google sign-in is enabled)


Optional:

- `NEXT_PUBLIC_API_URL` - API URL for client-side (defaults to current domain)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### CI/CD Pipeline

GitVerse uses GitHub Actions for continuous integration. Every pull request runs the full test suite automatically:

- **Lint** — ESLint checks for code quality
- **Type Check** — TypeScript compiler validation
- **Build** — Worker and application build verification
- **Unit Tests** — Jest test suite
- **Prisma Schema** — Schema formatting and validation
- **Playwright E2E** — Browser-based end-to-end tests
- **CodeQL** — Security vulnerability scanning
- **Worker Consistency** — Worker build integrity check

All checks must pass before a PR can be merged. See [CONTRIBUTING.md](CONTRIBUTING.md#ci-cd-pipeline) for detailed workflow documentation.

### Running CI Checks Locally

Run these commands before pushing to catch CI failures early:

```bash
# Lint and type check
npm run lint
npm run typecheck

# Unit tests
npm test

# Prisma schema validation
npx prisma validate
npx prisma format
```

### CI Environment Variables

The following environment variables are used by CI workflows. For unit tests, dummy values are configured inline. For E2E tests, configure these in your local `.env.local`:

| Variable | Description | Required For |
| :------- | :---------- | :----------- |
| `DATABASE_URL` | PostgreSQL connection string (Neon pooler URL for serverless) | Unit tests (dummy), E2E tests, Prisma migration |
| `JWT_SECRET` | JWT signing secret. Generate with `openssl rand -base64 32` | All auth endpoints |
| `NEXTAUTH_SECRET` | NextAuth session encryption key | NextAuth authentication |
| `NEXTAUTH_URL` | Application base URL (`http://localhost:3000` for local dev) | NextAuth OAuth callbacks |
| `GEMINI_API_KEY` | Google Gemini API key from [Google AI Studio](https://aistudio.google.com) | AI analysis features |
| `INTERNAL_WORKER_SECRET` | Worker API shared secret for internal communication | Analysis worker |
| `TOKEN_ENCRYPTION_KEY` | 32-byte hex key (64 hex chars) for encrypting OAuth tokens | GitHub integration token storage |
| `ANALYSIS_RUNNER_SECRET` | Analysis worker API authentication secret | Cron analysis pipeline |
| `CRON_SECRET` | Bearer token for authenticating cron webhook requests | Cron job endpoints |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID from Google Cloud Console | Google sign-in |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret from Google Cloud Console | Google sign-in |
| `GITHUB_APP_ID` | GitHub App ID for PR review integration | GitHub App features |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App private key (PEM format with `\n` line breaks) | GitHub App features |
| `GITHUB_WEBHOOK_SECRET` | Secret for verifying GitHub webhook payloads | Webhook receiver |

### CI Troubleshooting

- **Lint fails locally but passes in CI**: Ensure your ESLint configuration is up to date with `npm run lint -- --no-cache`. Check that you have the same ESLint plugins and configs installed as CI
- **Tests pass locally but fail in CI**: Check for environment-specific test behavior. CI uses mock database credentials — tests must not depend on a real database connection. Look for tests that read from `process.env` without mocks
- **Build succeeds locally but fails in CI**: Verify your lockfile is committed (`package-lock.json`) and in sync with `package.json`. Run `npm install` to regenerate the lockfile if needed
- **Playwright tests hang**: Ensure all async operations in tests have proper timeouts and cleanup. Check for unhandled promise rejections or missing `await` on page interactions
- **Prisma validation fails**: Run `npx prisma validate` and `npx prisma format` before committing schema changes. Check that the `DATABASE_URL` in `.env` points to a valid PostgreSQL instance
- **Worker consistency check fails**: Run `npm run build:worker` locally and commit any changes to `dist-worker/`. If the check still fails, verify the worker imports do not use server-only modules
- **Type check fails in CI but not locally**: Run `rm -f tsconfig.tsbuildinfo && npm run typecheck` to clear cached type information. The CI workflow deletes the tsbuildinfo file before running to ensure fresh checking
- **GitHub Actions workflow does not trigger**: Check that your branch is pushing to the `origin` remote, not `upstream`. Some workflows only run on specific branches or paths

## 💖 Contributors & Thanks

A huge thank you to all contributors who have helped improve GitVerse ❤️
Your efforts make this project stronger, more reliable, and more impactful for the community.

<p align="center">
  <a href="https://github.com/nisshchayarathi/gitverse-nextjs/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=nisshchayarathi/gitverse-nextjs" alt="Contributors"/>
  </a>
</p>

## ⭐ Project Support

<p align="center">
  <a href="https://github.com/nisshchayarathi/gitverse-nextjs/stargazers">
    <img src="https://img.shields.io/github/stars/nisshchayarathi/gitverse-nextjs?style=social" alt="Stars">
  </a>
  &nbsp;&nbsp;
  <a href="https://github.com/nisshchayarathi/gitverse-nextjs/network/members">
    <img src="https://img.shields.io/github/forks/nisshchayarathi/gitverse-nextjs?style=social" alt="Forks">
  </a>
</p>

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- Vercel for hosting solutions
- Google for Gemini AI
- NeonDB for serverless PostgreSQL
- All contributors and users of GitVerse

## ❓ FAQ – Common Questions & Edge Cases
> This section covers product behavior, limitations, and design decisions not included in troubleshooting.
### 1. Can GitVerse analyze very large repositories?
Yes, but performance depends on repo size.

- Small repos → fast (seconds)
- Medium repos → moderate (few seconds to a minute)
- Large monorepos → slower due to:
  - dependency graph building
  - AI summarization
  - full file traversal

### 2. Does GitVerse store repository data?
GitVerse may temporarily store:
- repository structure
- analysis results
- AI-generated summaries

This helps improve performance and reduce repeated computation. You can extend it to add long-term caching if needed.

### 3. What happens if GitHub API rate limits are hit?
If GitHub rate limits are reached:
- repository fetch may fail
- partial analysis may be returned

Recommended improvements:
- use GitHub App authentication for higher limits
- add retry with exponential backoff
- cache repository metadata

### 4. Does GitVerse support GitLab or Bitbucket?
Not currently.

GitVerse is built for GitHub only, but it can be extended by abstracting `gitService.ts` into provider-based adapters.

### 5. Is GitVerse real-time collaborative?
No.

Currently:
- single-user analysis only
- no shared sessions or live collaboration

Future idea:
- shared repo exploration rooms
- collaborative AI chat per repository

### 6. How accurate is AI-based architecture mapping?
AI results are:
- helpful for understanding structure
- not guaranteed to reflect runtime behavior perfectly

Accuracy depends on:
- code quality
- naming conventions
- project structure clarity

### 7. Can I customize graphs and visualizations?
Yes.

Modify:
src/components/visualizations/

You can customize:
- dependency graphs
- module maps
- risk heatmaps
- node layouts

### 8. Is GitVerse suitable for production-level analysis?
Yes, but mainly for:
- onboarding developers
- exploring unfamiliar codebases
- hackathon or OSS contribution workflows

It is not a replacement for full static analysis tools.

### 9. Can I customize AI prompts?
Yes.

Edit:
lib/services/geminiService.ts

You can change:
- architecture explanation style
- onboarding prompts
- risk detection logic
- suggestion formats

### 10. What makes GitVerse different from GitHub UI?
GitHub shows files.

GitVerse shows understanding:
- architecture map
- dependency flow
- hotspots & risks
- AI onboarding assistant

It turns a repo into a **learning system, not just a file browser**.

### 11. How does GitVerse prevent SSRF attacks against avatar URLs?

The avatar upload endpoint previously accepted any HTTP/HTTPS URL that passed a format check (protocol + hostname with a dot). An attacker could set their avatar to `http://169.254.169.254/latest/meta-data/` (AWS metadata) or `http://localhost:3000/api/admin/dlq` because no DNS resolution or IP validation was performed.

The fix reuses `validateSafeUrl` from `lib/utils/ssrfValidator.ts`, which resolves the hostname via `dns.lookup` and checks every resolved IP address against private, loopback, and link-local ranges. Only URLs that resolve entirely to public IP addresses are accepted. The validation also handles IPv6 addresses (::1, fc00::/7, fe80::/10).

### 12. What private IP ranges are blocked by the SSRF validator?

The validator blocks all RFC 1918 private addresses (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), loopback (127.0.0.0/8, ::1), link-local and cloud metadata (169.254.0.0/16), current network (0.0.0.0/8), IPv6 unique local addresses (fc00::/7), and IPv6 link-local addresses (fe80::/10). DNS resolution failures also result in rejection.

### 13. Does GitVerse support IPv6 for SSRF validation?

Yes. The `isPrivateIP` function in `lib/utils/ssrfValidator.ts` checks both IPv4 and IPv6 address ranges. IPv6 loopback (::1), unique local addresses (fc00::/7), and link-local addresses (fe80::/10) are all detected and blocked. The `dns.lookup` call with `{ all: true }` resolves both IPv4 and IPv6 records.

### 14. Why not just block hostnames like "localhost" or "169.254.169.254"?

Blocking hostnames by string matching is fragile. An attacker can use:
- Alternative representations (e.g., `2130706433` for `127.0.0.1` in decimal)
- DNS records that point to internal IPs (e.g., a domain that resolves to 10.0.0.1)
- IPv6 literal forms (e.g., `http://[::1]:3000/`)
- URL-encoded hostnames

The only reliable defense is to resolve the hostname to IP addresses and check those against restricted ranges. This is what `validateSafeUrl` does.

### 15. Can I skip SSRF validation for development?

No. SSRF validation should never be bypassed, even in development. The validation uses DNS resolution which works correctly in all environments. If you need to use an avatar URL from a local server during development, upload the image directly (multipart or data URL) instead of providing an HTTP URL.

### 16. How are HTTP URL avatars different from file uploads?

File uploads and data URLs are processed server-side — the image data is decoded, validated for MIME type and size, and stored on disk. The database stores a URL pointing to the local file. HTTP URL avatars are stored as-is and referenced directly from the user's browser, so the browser (not the server) fetches the image. This means:
- The server never fetches HTTP URL avatars (no server-side download)
- SSRF validation happens at the time the URL is submitted, not at render time
- If the URL points to a malicious site, the user's browser accesses it, not the server
- The validation prevents attackers from submitting URLs to internal services in the first place



---

## 🛡️ API Security Reference

This section documents the security measures applied to each API module. Use it as a quick reference when adding new endpoints.

| Endpoint | Auth | Rate Limit | Input Validation | SSRF Check |
| :------- | :--- | :--------- | :--------------- | :--------- |
| `POST /api/upload/avatar` | `requireAuth` | `AVATAR_UPLOAD` (5/hr) | File MIME + size, data URL, HTTP URL via `validateSafeUrl` | Yes (HTTP URLs) |
| `POST /api/auth/login` | Public | `AUTH` (10/min) | Email format, password length | N/A |
| `POST /api/auth/signup` | Public | `AUTH` (5/min) | Email, password, username validation | N/A |
| `POST /api/repositories/analyze` | `requireAuth` | `ANALYSIS` (20/hr) | URL validation via `validateSafeUrl` | Yes (repo URLs) |
| `POST /api/integrations/github/webhook` | Signature verification | None | Payload schema validation | N/A |
| `POST /api/cron/run-analysis` | `CRON_SECRET` | None | Job ID validation | N/A |

### Security Headers

The application sets the following security headers on all responses through Next.js middleware or server configuration:

| Header | Value | Purpose |
| :----- | :---- | :------ |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer header |
| `X-XSS-Protection` | `1; mode=block` | Enables XSS filter in older browsers |

### Rate Limiting Configuration

Rate limits are enforced per user session (authenticated requests) or per IP (unauthenticated requests). The rate limit configuration lives in `lib/middleware/rateLimit.ts`:

| Rate Limit Key | Namespace | Max Requests | Window | Applied To |
| :------------- | :-------- | :----------- | :----- | :--------- |
| `AVATAR_UPLOAD` | `upload:avatar` | 5 | 1 hour | Avatar upload endpoint |
| `AUTH_LOGIN` | `auth:login` | 10 | 1 minute | Login endpoint |
| `AUTH_SIGNUP` | `auth:signup` | 5 | 1 minute | Signup endpoint |
| `ANALYSIS` | `repo:analysis` | 20 | 1 hour | Repository analysis |

When a rate limit is exceeded, the server returns a `429 Too Many Requests` response with a JSON body containing the error code, message, and reset timestamp.

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- Vercel for hosting solutions
- Google for Gemini AI
- NeonDB for serverless PostgreSQL
- All contributors and users of GitVerse

## ❓ FAQ – Common Questions & Edge Cases
> This section covers product behavior, limitations, and design decisions not included in troubleshooting.
### 1. Can GitVerse analyze very large repositories?
Yes, but performance depends on repo size.

- Small repos → fast (seconds)
- Medium repos → moderate (few seconds to a minute)
- Large monorepos → slower due to:
  - dependency graph building
  - AI summarization
  - full file traversal

### 2. Does GitVerse store repository data?
GitVerse may temporarily store:
- repository structure
- analysis results
- AI-generated summaries

This helps improve performance and reduce repeated computation. You can extend it to add long-term caching if needed.

### 3. What happens if GitHub API rate limits are hit?
If GitHub rate limits are reached:
- repository fetch may fail
- partial analysis may be returned

Recommended improvements:
- use GitHub App authentication for higher limits
- add retry with exponential backoff
- cache repository metadata

### 4. Does GitVerse support GitLab or Bitbucket?
Not currently.

GitVerse is built for GitHub only, but it can be extended by abstracting `gitService.ts` into provider-based adapters.

### 5. Is GitVerse real-time collaborative?
No.

Currently:
- single-user analysis only
- no shared sessions or live collaboration

Future idea:
- shared repo exploration rooms
- collaborative AI chat per repository

### 6. How accurate is AI-based architecture mapping?
AI results are:
- helpful for understanding structure
- not guaranteed to reflect runtime behavior perfectly

Accuracy depends on:
- code quality
- naming conventions
- project structure clarity

### 7. Can I customize graphs and visualizations?
Yes.

Modify:
src/components/visualizations/

You can customize:
- dependency graphs
- module maps
- risk heatmaps
- node layouts

### 8. Is GitVerse suitable for production-level analysis?
Yes, but mainly for:
- onboarding developers
- exploring unfamiliar codebases
- hackathon or OSS contribution workflows

It is not a replacement for full static analysis tools.

### 9. Can I customize AI prompts?
Yes.

Edit:
lib/services/geminiService.ts

You can change:
- architecture explanation style
- onboarding prompts
- risk detection logic
- suggestion formats

### 10. What makes GitVerse different from GitHub UI?
GitHub shows files.

GitVerse shows understanding:
- architecture map
- dependency flow
- hotspots & risks
- AI onboarding assistant

It turns a repo into a **learning system, not just a file browser**.

### 11. How does GitVerse prevent SSRF attacks against avatar URLs?

The avatar upload endpoint previously accepted any HTTP/HTTPS URL that passed a format check (protocol + hostname with a dot). An attacker could set their avatar to `http://169.254.169.254/latest/meta-data/` (AWS metadata) or `http://localhost:3000/api/admin/dlq` because no DNS resolution or IP validation was performed.

The fix reuses `validateSafeUrl` from `lib/utils/ssrfValidator.ts`, which resolves the hostname via `dns.lookup` and checks every resolved IP address against private, loopback, and link-local ranges. Only URLs that resolve entirely to public IP addresses are accepted. The validation also handles IPv6 addresses (::1, fc00::/7, fe80::/10).

### 12. What private IP ranges are blocked by the SSRF validator?

The validator blocks all RFC 1918 private addresses (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), loopback (127.0.0.0/8, ::1), link-local and cloud metadata (169.254.0.0/16), current network (0.0.0.0/8), IPv6 unique local addresses (fc00::/7), and IPv6 link-local addresses (fe80::/10). DNS resolution failures also result in rejection.

### 13. Does GitVerse support IPv6 for SSRF validation?

Yes. The `isPrivateIP` function in `lib/utils/ssrfValidator.ts` checks both IPv4 and IPv6 address ranges. IPv6 loopback (::1), unique local addresses (fc00::/7), and link-local addresses (fe80::/10) are all detected and blocked. The `dns.lookup` call with `{ all: true }` resolves both IPv4 and IPv6 records.

### 14. Why not just block hostnames like "localhost" or "169.254.169.254"?

Blocking hostnames by string matching is fragile. An attacker can use:
- Alternative representations (e.g., `2130706433` for `127.0.0.1` in decimal)
- DNS records that point to internal IPs (e.g., a domain that resolves to 10.0.0.1)
- IPv6 literal forms (e.g., `http://[::1]:3000/`)
- URL-encoded hostnames

The only reliable defense is to resolve the hostname to IP addresses and check those against restricted ranges. This is what `validateSafeUrl` does.

### 15. Can I skip SSRF validation for development?

No. SSRF validation should never be bypassed, even in development. The validation uses DNS resolution which works correctly in all environments. If you need to use an avatar URL from a local server during development, upload the image directly (multipart or data URL) instead of providing an HTTP URL.

### 16. How are HTTP URL avatars different from file uploads?

File uploads and data URLs are processed server-side — the image data is decoded, validated for MIME type and size, and stored on disk. The database stores a URL pointing to the local file. HTTP URL avatars are stored as-is and referenced directly from the user's browser, so the browser (not the server) fetches the image. This means:
- The server never fetches HTTP URL avatars (no server-side download)
- SSRF validation happens at the time the URL is submitted, not at render time
- If the URL points to a malicious site, the user's browser accesses it, not the server
- The validation prevents attackers from submitting URLs to internal services in the first place

---
Made with ❤️ by the GitVerse Team

<!-- test branch change -->
