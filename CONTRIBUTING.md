# Contributing to GitVerse Next.js

Thank you for your interest in contributing to **GitVerse Next.js**! GitVerse is an AI-powered repository analyzer and assistant. We want to make contributing to this project as easy and transparent as possible.

By following these guidelines, you help keep the codebase clean, stable, and maintainable for everyone.

---

## Code of Conduct

We expect all contributors to adhere to a professional, respectful, and inclusive environment. Please be supportive, patient, and constructive in all communication and code reviews.

---

## Branching Conventions

We use a structured branch naming convention. Before you start writing code, make sure to create a branch from the `main` branch named according to the type of work you are doing:

| Branch Prefix | Purpose                                                    | Example                       |
| :------------ | :--------------------------------------------------------- | :---------------------------- |
| `feature/`    | New features, enhancements, or additions                   | `feature/ai-chat-history`     |
| `bugfix/`     | Fixing a bug or unexpected behavior                        | `bugfix/login-error-toast`    |
| `refactor/`   | Code structure changes with no new features/fixes          | `refactor/api-response-types` |
| `docs/`       | Updates or additions to documentation                      | `docs/contributing-guide`     |
| `chore/`      | Maintenance tasks, library upgrades, configuration changes | `chore/upgrade-prisma`        |

---

## Local Development Setup

To set up GitVerse Next.js locally, follow these steps:

### 1. Prerequisites

Ensure you have the following installed on your system:

- **Node.js**: Version 18 or newer (version 22.x recommended)
- **Git**: For version control
- **PostgreSQL**: Local instance or a remote database (Neon DB recommended)

### 2. Fork & Clone

Fork the repository on GitHub, then clone your fork or the upstream repository locally:

```bash
git clone https://github.com/<your-username>/gitverse-nextjs.git
cd gitverse-nextjs
```

### 3. Install Dependencies

Install all required package dependencies:

```bash
npm install
```

### 4. Configure Environment Variables

Create a local environment file by copying the example template:

```bash
cp .env.example .env.local
```

Edit `.env.local` and configure your credentials:

- **`DATABASE_URL`**: Your PostgreSQL connection string.
- **`JWT_SECRET`**: A secure, random string used for local JWT sessions.
- **`GEMINI_API_KEY`**: Obtain this from Google MakerSuite to enable AI Assistant features.
- **`NEXTAUTH_SECRET`** and **`NEXTAUTH_URL`**: For session authentication.

> [!IMPORTANT]
> Always copy `.env.local` to `.env` as well so that the Prisma CLI can read your database connection:
>
> ```bash
> cp .env.local .env
> ```

### 5. Generate and Migrate Database

Initialize your database and generate the Prisma Client:

```bash
# Generate the type-safe Prisma client
npm run prisma:generate

# Apply migrations to your database
npm run prisma:migrate
```

### 6. Run the Application

Start the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application in action.

---

## Commit Message Guidelines

We enforce a professional commit message style based on the **Conventional Commits** standard. This structure makes our project git history clean, readable, and easy to parse automatically.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Allowed Types

- **`feat`**: A new feature or enhancement
- **`fix`**: A bug fix
- **`docs`**: Documentation changes only
- **`style`**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc.)
- **`refactor`**: A code change that neither fixes a bug nor adds a feature
- **`perf`**: A code change that improves performance
- **`test`**: Adding missing tests or correcting existing tests
- **`chore`**: Changes to the build process or auxiliary tools and libraries

### Example Commits

- **New feature**: `feat(ai): add history logs to repository chatbot dashboard`
- **Bugfix**: `fix(auth): redirect user to login on token expiration`
- **Documentation**: `docs(readme): update environment setup instructions`

---

## Issue Auto-Labeling

Issues opened in this repository are automatically labeled from keyword matches in the issue title and body.

Current supported categories include `gssoc-2026`, `bug`, `feature`, `documentation`, `ui`, and `infra`.

To add or adjust patterns, edit [`.github/workflows/auto-label.yml`](.github/workflows/auto-label.yml) and update the `labelRules` list. Keep the label names in sync with the labels used in GitHub so the workflow can apply them consistently.

---

## Pre-submission Checklist

Before pushing your changes and opening a Pull Request, please ensure you perform the following checks locally:

### 1. Code Formatting

Format your code using Prettier:

```bash
npm run format
```

### 2. Linting

Verify there are no syntax or pattern warnings from ESLint:

```bash
npm run lint
```

### 3. Type Checking

Make sure your TypeScript changes compile successfully:

```bash
npm run typecheck
```

---

## Submitting a Pull Request (PR)

1. **Commit and Push**: Commit your changes using a Conventional Commit message, and push your branch:
   ```bash
   git push origin feature/your-feature-name
   ```
2. **Open a PR**: Go to the GitHub repository and click "Compare & pull request".
3. **Describe Your Changes**:
   - Provide a clear explanation of _what_ you changed and _why_.
   - Link any related issues using `Fixes #<issue-number>`.
4. **Await Review**: Core maintainers will review your changes, offer feedback, and merge once all criteria are met.

---

## CI/CD Pipeline

GitVerse uses GitHub Actions for continuous integration and deployment. Every pull request and push to `main` triggers a set of automated checks that validate code quality, type safety, database schema integrity, and test coverage.

### Workflow Overview

| Workflow | File | Trigger | Purpose |
| :------- | :--- | :------ | :------ |
| Test Platform | [test.yml](.github/workflows/test.yml) | PR + push to main | Lint, typecheck, build, unit tests |
| Playwright Tests | [playwright.yml](.github/workflows/playwright.yml) | PR + push to main | E2E browser tests |
| Prisma Schema Check | [prisma-check.yml](.github/workflows/prisma-check.yml) | PR + push to main | Schema formatting and validation |
| CodeQL | [codeql.yml](.github/workflows/codeql.yml) | PR + push to main + weekly | Security vulnerability scanning |
| Run Analysis Worker | [run-analysis-cron.yml](.github/workflows/run-analysis-cron.yml) | Every 5 minutes | Scheduled analysis job processing |
| Worker Consistency | [worker-consistency.yml](.github/workflows/worker-consistency.yml) | PR + push to main (worker paths only) | Verifies worker build integrity |
| Auto Label Issues | [auto-label.yml](.github/workflows/auto-label.yml) | Issue opened | Automatic label assignment |
| GSSoC Auto Assign | [gssoc-auto-assign.yml](.github/workflows/gssoc-auto-assign.yml) | Issue comment | Self-assign and maintainer assign |
| GSSoC Auto Label on Merge | [gssoc-auto-label-on-merge.yml](.github/workflows/gssoc-auto-label-on-merge.yml) | PR merged | Apply GSSoC labels and close issues |
| GSSoC PR Spam Detection | [gssoc-spam-detection.yml](.github/workflows/gssoc-spam-detection.yml) | PR opened/edited | Quality and spam checks |

### Test Platform (test.yml)

The primary CI pipeline runs four sequential stages in dependency order: lint → typecheck → build → test. Each stage must pass before the next begins, and failures at any stage block the pipeline.

#### Stage 1: Lint (Job: `lint`)

- **Command**: `npm run lint`
- **Purpose**: Runs Next.js ESLint to enforce code style and catch common errors
- **Trigger**: Every pull request and push to main
- **Dependencies**: `actions/checkout@v4` fetches the source, `actions/setup-node@v4` configures Node.js with npm caching
- **Failures indicate**: Unused imports, undeclared variables, React hooks violations, accessibility issues
- **Common fixes**: Run `npm run lint` locally and address each reported rule. Use `// eslint-disable-next-line <rule>` sparingly only when the rule does not apply

#### Stage 2: Type Check (Job: `typecheck`)

- **Command**: `npm run typecheck` which runs `prisma generate && rm -f tsconfig.tsbuildinfo && tsc -p tsconfig.json --noEmit`
- **Purpose**: Verifies TypeScript types are correct across the full codebase
- **Prerequisites**: Prisma client must be generated first because typecheck imports it
- **Dependencies**: `actions/checkout@v4`, `actions/setup-node@v4` with npm cache, `npm install`, `npx prisma generate`
- **Failures indicate**: Type mismatches, missing module declarations, incorrect generic parameters, structural type errors
- **Common fixes**: Fix reported type errors. If a dependency lacks types, install `@types/<package>` or add a declaration file in `types/`
- **Edge case**: The `tsconfig.json` uses `paths` aliases (`@/lib/*`, `@/app/*`, etc.) that must be resolvable by both Next.js and TypeScript. If a path alias change is made, update `tsconfig.json` and verify typecheck passes

#### Stage 3: Build (Job: `build`)

- **Depends on**: `lint`, `typecheck` — ensures only code that passes quality checks reaches build
- **Steps**:
  1. **Verify build artifacts not committed** — Ensures `dist-worker/` is not tracked in git. If it is, the step exits with error and instructs `git rm -r --cached dist-worker/`
  2. **Build worker** — `npm run build:worker` compiles `scripts/` and `lib/` TypeScript sources into `dist-worker/` JavaScript bundles
- **Dependencies**: `actions/checkout@v4`, `actions/setup-node@v4` with npm cache, `npm install`, `npx prisma generate`
- **Failures indicate**: TypeScript compilation errors in the worker codebase, or accidental commits of build output
- **Common fixes**: Verify `tsconfig.worker.json` references all required files. Check that worker imports from `lib/` do not import server-only modules
- **Edge case**: The worker uses a separate `tsconfig.worker.json` configuration. Changes to `lib/` must be compatible with both the main tsconfig and the worker tsconfig

#### Stage 4: Unit Tests (Job: `test`)

- **Depends on**: `build` — ensures compiled artifacts exist before running tests
- **Command**: `npm test` (Jest) with mock environment variables
- **Dependencies**: `actions/checkout@v4`, `actions/setup-node@v4` with npm cache, `npm install`, `npx prisma generate`
- **Environment**: Uses dummy values for all database and auth secrets. Tests must NOT depend on a real database connection
- **Failures indicate**: Assertion failures, incorrect mocks, missing test coverage for new code paths
- **Common fixes**: Run `npm test -- --verbose` locally to see which assertions fail. Update snapshots with `npm test -- --updateSnapshot` if UI changes are intentional
- **Edge cases**: Tests that require Prisma should use `mockDeep` from `vitest-mock-extended` or similar tools. Never connect to a real database from unit tests

#### Concurrency Control

The entire workflow uses `concurrency` with `cancel-in-progress: true`:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

This ensures that when a new commit is pushed to an existing PR, any in-progress CI run for that branch is automatically cancelled. This saves CI minutes and prevents redundant work on stale code. The group key includes both the workflow name and the git ref, so different workflows on the same branch are not affected.

### Playwright Tests (playwright.yml)

End-to-end browser tests using Playwright. Runs on push to `main` or `master` and on pull requests targeting those branches.

- **Job**: `test` with 60-minute timeout
- **Node version**: 22.x with npm caching
- **Steps**:
  1. Checkout source code
  2. Setup Node.js with `cache: 'npm'` — the npm cache is shared across all workflows that use the same lockfile, speeding up dependency installation when consecutive runs share the cache key
  3. Install dependencies with `npm ci`
  4. Install Playwright browsers and their system dependencies with `npx playwright install --with-deps`
  5. Generate Prisma client with `npx prisma generate`
  6. Run E2E tests with `npm run test:e2e` using mock environment variables
  7. Upload test artifacts (playwright-report/) using `actions/upload-artifact@v4` with 30-day retention, even if the test suite cancels
- **Failing tests**: Review the uploaded Playwright report artifact. It contains screenshots, traces, and videos of failing tests
- **Running locally**: `npx playwright install && npm run test:e2e`

### Prisma Schema Check (prisma-check.yml)

Ensures the Prisma schema file is properly formatted and syntactically valid.

- **Jobs**: `validate` — Validate and Format Schema
- **Steps**:
  1. Checkout, setup Node with npm cache, install dependencies
  2. `npx prisma format` — Formats the schema according to Prisma conventions. After formatting, runs `git diff --exit-code prisma/schema.prisma` to fail if the schema was not already formatted
  3. `npx prisma validate` — Checks schema syntax, relation integrity, field types, datasource configuration, and generator settings
- **Failures indicate**:
  - Schema not formatted: Run `npx prisma format` locally and commit the result
  - Schema invalid: Check for missing models, incorrect relation syntax, unsupported field types, or datasource misconfiguration
- **Edge cases**: The validation step requires a `DATABASE_URL` environment variable to connect to the database provider metadata. In CI, a dummy URL is used since `prisma validate` does not execute queries against it

### CodeQL (codeql.yml)

GitHub's CodeQL security analysis for JavaScript and TypeScript.

- **Schedule**: On every push and pull request to `main`, plus every Tuesday at 3:17 UTC
- **Languages analyzed**: `javascript-typescript` (covers both `.ts` and `.tsx` files)
- **Steps**:
  1. Checkout repository
  2. Initialize CodeQL with the `javascript-typescript` language pack
  3. Autobuild — CodeQL automatically detects the build system and configures the database
  4. Perform analysis — Runs query suites against the CodeQL database
- **Permissions**: Job-level permissions set `actions: read`, `contents: read`, `security-events: write` so results appear in the Security tab
- **Alerts**: CodeQL findings appear in the GitHub Security tab and on the PR checks. A CodeQL alert does not block merging but should be reviewed. Common findings include:
  - Client-side URL redirection to untrusted origins
  - Reflected cross-site scripting via user input
  - Incomplete URL sanitization in redirect handlers
  - Hardcoded credentials or secrets
- **Suppressing false positives**: Add a `// CodeQL [<rule-id>]` comment on the line above the flagged code

### Run Analysis Worker (run-analysis-cron.yml)

Scheduled workflow that processes queued repository analysis jobs every 5 minutes.

- **Trigger**: `*/5 * * * *` cron schedule plus manual `workflow_dispatch`
- **Timeout**: 240 seconds per worker run (`CRON_WORKER_TIMEOUT_MS`)
- **Batch size**: 5 jobs per run (`CRON_WORKER_BATCH`)
- **Steps**:
  1. Checkout and setup Node.js with npm caching
  2. Install dependencies with `npm ci`
  3. Verify Prisma schema file exists
  4. Generate Prisma client with explicit schema path
  5. Build worker with `npm run build:worker`
  6. **Pre-flight database health check** — Connects to the database with `SELECT 1` via `prisma.$queryRaw`. If this fails, the workflow exits early before attempting to process jobs. This prevents cascading failures when the database is unreachable
  7. **Release stale locks** — Updates any `analysis_jobs` stuck in `PROCESSING` status with an expired `lockExpiresAt` back to `QUEUED`. This recovers jobs that were abandoned by crashed or killed workers
  8. **Run worker** — Executes `node dist-worker/scripts/cronWorker.js` with a 240-second `timeout` command. Uses a bash trap to clean up the child process on SIGTERM/SIGINT
  9. **Report failure** — If the worker exits with a non-zero code, creates an issue titled `[Infra] Analysis Worker Failure (run <runId>)` with workflow run link and troubleshooting steps. Checks for existing duplicate issues before creating
- **Secrets**: Uses `DATABASE_URL`, `ANALYSIS_RUNNER_SECRET`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_ID`, `GITHUB_APP_SLUG`

### Worker Consistency (worker-consistency.yml)

Verifies that the TypeScript worker sources compile to the expected JavaScript output in `dist-worker/`.

- **Trigger**: Runs on PRs and pushes to `main` that modify `scripts/**`, `lib/**`, `tsconfig.worker.json`, or `package.json`
- **Path filtering**: Uses GitHub Actions `paths` filter at the workflow level. PRs that only change non-worker files skip this workflow entirely, saving CI minutes
- **Steps**:
  1. Checkout, setup Node with npm caching, install dependencies
  2. Generate Prisma client
  3. Build worker with `npm run build:worker`
  4. **Verify dist-worker is not committed** — Runs `git ls-files --error-unmatch dist-worker/` and fails if the directory is tracked. Build output must remain in `.gitignore`
  5. **Run consistency checks** — Executes `npx tsx scripts/verify-worker-consistency.ts` to validate worker-side invariants
  6. **Verify build output is fresh** — Temporarily stages `dist-worker/` and checks if it produces a diff from the committed version. If the build output has changed (e.g., from a dependency update or source change), the step fails and instructs the contributor to rebuild and commit the updated output
  7. **Verify worker scripts can be required** — Attempts `require('./dist-worker/lib/prisma')` to confirm the compiled JavaScript loads without syntax errors. The module import for `@prisma/client` may fail gracefully when no `DATABASE_URL` is available, which is considered acceptable
- **Edge cases**: If the worker sources and the committed build output are out of sync, running `npm run build:worker` locally and committing the updated `dist-worker/` will resolve the failure

### GSSoC Automation Workflows

Three workflows manage the GirlScript Summer of Code program contributor lifecycle, from issue assignment to merge scoring. These workflows run on `pull_request_target` and `issue_comment` events, so they have access to repository secrets.

#### Auto Assign (gssoc-auto-assign.yml)

Triggers on `issue_comment` created events. Filters out bot comments and PR comments. Supports four operations:

**Self-assignment** (`/assign`, `/claim`, `/take`):
1. Validates the issue is open and not already assigned to the commenter
2. Checks the issue is not already assigned to someone else under GSSoC management
3. **Concurrent limit check**: Counts all open issues assigned to the user via `github.rest.issues.listForRepo` with `assignee` filter. If at or above the limit of 1, posts a denial comment listing the user's active issues
4. **Daily limit check**: Scans events on all assigned issues to count how many were assigned today UTC. If at or above the daily limit of 4, posts a denial comment with the count and instructions to try again tomorrow
5. Adds the commenter as an assignee, applies `gssoc:assigned` label, removes `gssoc:available` label
6. Posts a confirmation comment with deadline (7 days), active issue count, and remaining daily slots

**Maintainer assignment** (`/assign @username`):
1. Verifies the commenter has admin, maintain, or write permission via `github.rest.repos.getCollaboratorPermissionLevel`
2. Checks the target user is within concurrent and daily limits
3. Assigns the target user, applies labels, posts a confirmation comment

**Self-unassignment** (`/unassign`, `/drop`, `/abandon`, `/release`):
1. Removes the commenter from the assignee list
2. If no assignees remain, removes `gssoc:assigned` and adds `gssoc:available` to reopen the issue for others
3. Posts an unassignment comment

**Maintainer unassignment** (`/unassign @username`):
1. Verifies the commenter has maintainer permissions
2. Removes the target user from assignees
3. Same label cleanup as self-unassignment

**Required labels** that the workflow auto-creates if missing: `gssoc:assigned`, `gssoc:available`, `gssoc:approved`, `level:beginner`, `level:intermediate`, `level:advanced`, `GSSoC'26`.

#### Auto Label on Merge (gssoc-auto-label-on-merge.yml)

Triggers on `pull_request_target` with `types: [closed]` and only proceeds when `github.event.pull_request.merged == true`. Runs these operations in sequence:

1. **Auto-assign PR author**: Assigns the merged PR to its author so the contribution is attributed
2. **Label creation**: Ensures all GSSoC and quality labels exist, creating them if missing
3. **Spam check**: Reads current PR labels. If any of `gssoc:spam`, `gssoc:invalid`, `gssoc:ai-slop`, or `do-not-merge` are present, the approved label and issue auto-close are skipped
4. **Difficulty level calculation**: Uses `pr.additions + pr.deletions` to determine the level:
   - > 600 lines changed: `level:critical` (60 points)
   - > 400 lines changed: `level:advanced` (45 points)
   - > 200 lines changed: `level:intermediate` (25 points)
   - ≤ 200 lines changed: `level:beginner` (10 points)
   If the PR already has a level label, it is preserved and used for linked issues
5. **Mentor attribution**: Applies `mentor:nisshchayarathi` to the PR
6. **Linked issue detection**: Scans the PR body for `closes`, `fixes`, or `resolves` keywords followed by `#<number>`, then falls back to any bare `#<number>` reference not inside a URL
7. **Linked issue updates**: For each linked issue:
   - Applies `gssoc:approved` label
   - Syncs difficulty level from the PR
   - Propagates `type:*` labels from the PR to the issue
   - Copies `type:*`, `bug`, `feature`, `enhancement`, `documentation` labels from the issue back to the PR
   - Applies `mentor:nisshchayarathi`
   - Posts a comment summarizing the merge
   - Auto-closes the issue if open

#### Spam Detection (gssoc-spam-detection.yml)

Triggers on `pull_request_target` with `types: [opened, edited, reopened, synchronize]`. Runs a series of quality checks and applies labels accordingly:

1. **Already flagged check**: If the PR already has `gssoc:spam`, `gssoc:invalid`, or `gssoc:ai-slop`, skips re-processing
2. **Quality rules**:
   - **Rule 1 — Empty body**: Strips HTML comments from the PR body. If the remaining text is under 30 characters, flags as `gssoc:invalid`
   - **Rule 2 — Generic title**: Matches the PR title against known spam patterns. Flags titles like "fix", "update", "test", "minor change" as `gssoc:spam`
   - **Rule 3 — Trivially small**: If total changes ≤ 3 lines in 1 file, flags as `gssoc:spam`
   - **Rule 4 — README-only with no issue**: If only documentation files were changed and no issue is linked, flags as `gssoc:invalid`
   - **Rule 5 — No linked issue**: If the body has no `closes`, `fixes`, or `resolves` pattern, flags as `gssoc:invalid`
   - **Rule 6 — AI-slop language**: Scans title and body for AI-generated text patterns like "as an AI language model", "certainly, here is", "hope this helps". Flags as `gssoc:ai-slop`
   - **Rule 7 — Duplicate word spam**: If any word appears 3+ times in the title, flags as `gssoc:spam`
3. **Label priority**: If multiple rules match, the most severe label wins: `gssoc:ai-slop` > `gssoc:spam` > `gssoc:invalid`
4. **Warning comment**: Posts a detailed comment explaining which rules were violated and how to fix them
5. **Clean PRs**: If no rules match, adds the `GSSoC'26` label and posts a welcome comment with a check summary

### Dependabot Configuration (dependabot.yml)

Dependabot is configured to automatically open pull requests for dependency updates:

- **npm ecosystem**: Weekly updates for npm packages, grouped into `nextjs` (`next`, `eslint-config-next`) and `prisma` (`@prisma/*`, `prisma`) groups to reduce PR noise. Limit of 5 open PRs at a time
- **GitHub Actions ecosystem**: Weekly updates for GitHub Action versions used in workflows

When Dependabot opens a PR, all standard CI checks run against it. Grouped dependencies are batched into a single PR per group.

### Workflow Dependency Graph

The following diagram shows how the workflows relate to each other and to the PR lifecycle:

```
PR opened ──► Spam Detection ──► Lint ──► TypeCheck ──► Build ──► Tests
                  │
                  ├── Flagged: warning comment, no further action
                  └── Clean: welcome comment, CI continues

PR merged ──► Auto Label on Merge ──► Assign author
                  │                       │
                  ├── Calculate level      ├── Apply labels to PR
                  ├── Find linked issue    ├── Apply labels to issue
                  └── Close issue          └── Post merge comment

Issue opened ──► Auto Label (keyword match)

Issue comment ──► Auto Assign ──► Self-assign or
                  Maintainer assign/unassign
```

### Development Guidelines

#### Code Style

- **Formatting**: Use `npm run format` (Prettier) before committing. The project uses Prettier with default settings for TypeScript and CSS files
- **Imports**: Group imports by third-party → internal → relative. Use path aliases (`@/lib/*`, `@/app/*`, `@/types/*`) for internal imports
- **Naming**:
  - Files: `camelCase.ts` for utilities, `PascalCase.tsx` for components, `kebab-case` for directories
  - Functions: `camelCase` for regular functions, `PascalCase` for React components
  - Types/interfaces: `PascalCase` with `I` prefix only for interfaces that mirror class contracts
  - Booleans: Prefix with `is`, `has`, `should`, `can` (e.g., `isLoading`, `hasError`)
  - Event handlers: Prefix with `handle` (e.g., `handleSubmit`, `handleClick`)
- **Error handling**: Use typed error responses in API routes. Never expose internal error details to the client. Log errors server-side with sufficient context for debugging
- **Async operations**: Always `await` promises in server-side code. Use `.catch()` for fire-and-forget operations. Prefer `Promise.all()` for parallel independent operations
- **Environment variables**: Access environment variables through `process.env` only in server components and API routes. Prefix client-exposed variables with `NEXT_PUBLIC_`

#### Testing Guidelines

**Unit tests** (Jest):
- Place test files in `__tests__/` directories next to the code they test
- Name test files `<module>.test.ts` or `<module>.test.tsx`
- Use `describe` blocks to group related tests, `it` blocks for individual assertions
- Mock external services (database, AI API, GitHub API) using Jest mocks or `vitest-mock-extended`
- Do not rely on a running database for unit tests. Use `mockDeep` to mock Prisma client methods
- Test both success and error paths for every function
- Aim for at least 80% line coverage on new code

**E2E tests** (Playwright):
- Place test files in `tests/` directory
- Use Playwright's test fixtures for authenticating test users
- Test critical user flows: login, repository search, analysis trigger, AI chat
- Avoid testing visual appearance (screenshots are for debugging, not assertions)

#### Database Guidelines

- **Schema changes**: Always create a new migration when modifying `prisma/schema.prisma`. Run `npm run prisma:migrate -- --name <description>` to generate migration files
- **Migrations**: Commit migration files to git. Never modify existing migration files after they are committed — create a new migration instead
- **Client generation**: Run `npm run prisma:generate` after every schema change to regenerate the type-safe Prisma client. The CI pipeline checks that migrations and client generation are up to date
- **Query performance**: Use `select` to fetch only the fields you need. Use `include` for relations sparingly. Add `@index` annotations on columns used in `where`, `orderBy`, or `join` conditions
- **Connection pooling**: For serverless deployments (Vercel), use the NeonDB pooler URL as `DATABASE_URL`. For local development, use a direct PostgreSQL connection
- **Data seeding**: Use `npm run db:seed` to populate the database with realistic test data. The seed script clears existing data before inserting new records

#### Security Considerations

- **Authentication**: All API routes that handle user-specific data must verify the session. Use the `requireAuth` middleware from `lib/middleware/authMiddleware.ts`. Never trust user-supplied IDs without verifying ownership
- **Authorization**: Implement resource-level authorization in each API route. A user should only access their own repositories, sessions, and profile data. Check ownership before read or write operations
- **Input validation**: Validate and sanitize all user inputs on the server side. Client-side validation is for UX only. Use structured validation for JSON bodies and regex patterns for URL and path parameters
- **Rate limiting**: Sensitive endpoints (auth, API keys) use rate limiting to prevent abuse. Rate limits are enforced per user session or IP address. The rate limit configuration is in `lib/middleware/rateLimit.ts`
- **Secrets management**: Never hardcode secrets. Use environment variables for all credentials. Mark secrets as Sensitive in Vercel. Rotate secrets regularly. Check for leaked secrets with `git secrets` or similar tools before committing
- **CSRF protection**: NextAuth includes CSRF protection for authentication routes. For custom API routes, validate the request origin header
- **File uploads**: Avatar uploads validate file type and size server-side. URLs for external avatars must pass SSRF validation (DNS resolution and private IP range checks) before being stored. The `validateSafeUrl` function in `lib/utils/ssrfValidator.ts` performs this check
- **URL validation**: Any feature that accepts user-supplied HTTP URLs (avatars, repository URLs, webhook URLs) must validate them against SSRF vectors. Use `validateSafeUrl` from `lib/utils/ssrfValidator.ts` which resolves DNS and checks all resolved IPs against private, loopback, and link-local ranges. Do not write ad-hoc URL format checks that only verify protocol and hostname structure

##### Server-Side Request Forgery (SSRF) Prevention

SSRF attacks occur when an attacker provides a URL that the server fetches or stores, pointing to internal services, cloud metadata endpoints, or other restricted resources. GitVerse uses a layered defense:

**1. DNS Resolution and IP Range Validation**

The `validateSafeUrl` function in `lib/utils/ssrfValidator.ts` validates URLs at the network level:
- Resolves the hostname via `dns.lookup` to get all resolved IP addresses (both IPv4 and IPv6)
- Checks every resolved address against private IP ranges:
  - `10.0.0.0/8` — RFC 1918 private space
  - `172.16.0.0/12` — RFC 1918 private space
  - `192.168.0.0/16` — RFC 1918 private space
  - `127.0.0.0/8` — IPv4 loopback
  - `169.254.0.0/16` — Link-local and cloud metadata (including AWS 169.254.169.254)
  - `0.0.0.0/8` — Current network
  - `::1/128` — IPv6 loopback
  - `fc00::/7` — IPv6 unique local addresses
  - `fe80::/10` — IPv6 link-local addresses
- If any resolved IP falls into a restricted range, the URL is rejected
- If DNS resolution fails (NXDOMAIN, timeout), the URL is considered unsafe and rejected

**2. Avatar URL Validation**

The avatar upload endpoint (`/api/upload/avatar`) handles three input types:
- **File uploads**: Validated for MIME type and file size, stored server-side. No SSRF vector
- **Data URLs**: Parsed server-side, decoded, and stored. No external fetch required
- **HTTP/HTTPS URLs**: Must pass `validateSafeUrl` validation before storage. The `validateHttpAvatarUrl` function first checks format (protocol, hostname structure) then delegates to `validateSafeUrl` for DNS resolution and IP range checking

**3. When to Apply SSRF Validation**

Use `validateSafeUrl` for any user-supplied URL that the server will:
- Fetch or download (webhook payloads, repository cloning, avatar fetching)
- Store and render server-side (avatar URLs, profile links)
- Forward to internal services (webhook forwarding, proxy endpoints)

Do not use `validateSafeUrl` for:
- URLs that are only displayed as text (user profile links in markdown)
- URLs that are handled entirely client-side (external image embeds in rich text)
- URLs that the server never touches (external link fields stored for reference only)

**4. Defense in Depth**

Beyond SSRF validation, follow these practices:
- Run background workers in isolated environments with minimal network access (no metadata endpoint access, no internal service discovery)
- Use network policies and firewalls to restrict outbound traffic from worker processes to only required external services (GitHub API, Google Gemini API)
- Log all rejected URL validation attempts with the hostname and reason for auditing
- Regularly audit new features that accept URLs to ensure SSRF validation is applied

### Testing Patterns

This project uses specific testing patterns that all contributors should follow:

#### Unit Test Structure

Place test files in `__tests__/` directories adjacent to the module they test:

```
lib/services/imageService.ts
lib/services/__tests__/imageService.test.ts

lib/utils/ssrfValidator.ts
lib/utils/__tests__/ssrfValidator.test.ts

app/api/upload/avatar/route.ts
app/api/upload/avatar/__tests__/route.test.ts
```

Each test file follows this structure:
- Top-level `describe("moduleName")` block
- Nested `describe("functionName")` blocks for each exported function
- Individual `it("describes the specific behavior")` test cases
- `beforeEach` for common mock setup and state reset

#### Mocking External Dependencies

**Database (Prisma):** Never connect to a real database. Use `mockDeep` from `vitest-mock-extended` or jest.fn() to mock Prisma client methods. Mock at the module boundary using `jest.mock("@/lib/prisma", ...)`.

**Network calls (DNS, HTTP):** For functions that call `dns.lookup` or make HTTP requests, use one of two approaches:
- **Integration tests**: Use real DNS resolution with IP literal URLs (e.g., `http://10.0.0.1/test`). The `dns.lookup` function returns the IP address directly for literal IPs without performing a DNS query, making these tests fast and deterministic
- **Mocked tests**: Use `jest.mock` for the network module. Note that Node.js built-in modules like `dns/promises` require the mock factory to reference a variable accessible at module load time

Example of network-independent testing:
```typescript
// Tests private IP blocking without mocking DNS
it("rejects URLs with private IPs", async () => {
  const result = await validateSafeUrl("http://10.0.0.1/config");
  expect(result).toBe(false);
});
```

**File system:** Use mock files and FormData objects in tests. The `File` constructor works in Jest with the `undici` polyfill:

```typescript
const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });
const formData = new FormData();
formData.append("file", file);
```

#### Testing Async Functions

When a synchronous function is changed to async:
1. Update the function signature (add `async` and `Promise<>` return type)
2. Update all callers to `await` the function
3. Update the mock in test files — `mockReturnValue` works with `await` but `mockResolvedValue` is clearer
4. Update direct test calls to use `await`
5. Add test cases for the async behavior (e.g., "does not call network function when format check fails")

Example async migration:
```typescript
// Before
export function validateHttpAvatarUrl(url: string): ImageValidationResult { ... }

// After
export async function validateHttpAvatarUrl(url: string): Promise<ImageValidationResult> { ... }
```

#### Edge Case Testing

For each function, test these categories:
- **Happy path**: Valid inputs produce expected success
- **Format validation**: Invalid formats are rejected before processing
- **Security validation**: Restricted inputs are blocked (private IPs, malicious protocols)
- **Boundary conditions**: Values at or near thresholds (IP range boundaries, file size limits)
- **Error handling**: Function behaves correctly when dependencies throw
- **Side effects**: Mocked functions are called with expected arguments and not called when validation fails early

### Running Tests Locally

Before pushing, run the same checks locally that CI will run:

```bash
# Lint check
npm run lint

# TypeScript type checking
npm run typecheck

# Unit tests
npm test

# E2E tests (requires Playwright browsers)
npm run test:e2e

# Prisma schema validation
npx prisma validate
npx prisma format
```

For continuous testing during development, use Jest watch mode:

```bash
npm test -- --watch
```

To run a specific test file:

```bash
npm test -- --testPathPattern="rateLimit"
```

### Environment Variables Required by CI

The CI workflows use mock environment variables for unit tests. These are defined inline in the workflow files and do not need to be set in your local environment. However, for full E2E tests, the following must be configured:

- `DATABASE_URL` — PostgreSQL connection string (Neon pooler URL for serverless)
- `JWT_SECRET` — JWT signing secret for local sessions
- `NEXTAUTH_SECRET` — NextAuth session encryption key
- `NEXTAUTH_URL` — Application URL (http://localhost:3000 for development)
- `GEMINI_API_KEY` — Google Gemini API key for AI analysis
- `INTERNAL_WORKER_SECRET` — Internal API authentication secret
- `TOKEN_ENCRYPTION_KEY` — 32-byte hex key for OAuth token encryption
- `ANALYSIS_RUNNER_SECRET` — Secret for authenticating analysis runner API calls
- `CRON_SECRET` — Bearer token for cron job endpoint authentication
- `GOOGLE_CLIENT_ID` — Google OAuth client ID (Google sign-in)
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret (Google sign-in)
- `GITHUB_APP_ID` — GitHub App ID (PR review integration)
- `GITHUB_APP_PRIVATE_KEY` — GitHub App private key in PEM format
- `GITHUB_WEBHOOK_SECRET` — Secret for verifying GitHub webhook payloads

### TypeScript Configuration

The project uses multiple TypeScript configuration files for different compilation targets:

| File | Target | Purpose |
| :--- | :----- | :------ |
| `tsconfig.json` | Next.js app | Main configuration for the Next.js application code in `src/`, `app/`, `lib/` |
| `tsconfig.worker.json` | Node.js worker | Configuration for the background analysis worker in `scripts/` and `lib/` (compiled to `dist-worker/`) |

Key `tsconfig.json` settings:
- **`paths`** — Path aliases (`@/lib/*`, `@/app/*`, `@/types/*`) must be kept in sync with Jest module name mapping in `jest.config.js`
- **`strict: true`** — All strict type-checking options are enabled
- **`moduleResolution: bundler`** — Next.js uses the bundler module resolution strategy
- **`jsx: preserve`** — JSX is preserved for Next.js SWC compilation

The worker tsconfig differs from the main config:
- **`module: commonjs`** — Worker runs in Node.js, not the browser
- **`outDir: dist-worker`** — Compiled output goes to a separate directory
- **`include`** — Only `scripts/` and `lib/` paths, excluding `src/` and `app/`

When adding new imports from `lib/` to worker scripts, ensure the imported module does not use browser APIs, Next.js server-only features, or React. The worker runs in a plain Node.js context.

### Common CI Failures and Fixes

| Failure | Likely Cause | Fix |
| :------ | :----------- | :-- |
| Lint fails | ESLint rule violation | Run `npm run lint` locally and fix reported issues |
| Type check fails | TypeScript type error | Run `npm run typecheck` locally and resolve type mismatches |
| Build worker fails | Worker code does not compile | Check `scripts/` and `lib/` for TypeScript errors |
| Unit tests fail | Test assertion failure or missing mock | Run `npm test` locally with `--verbose` to see which test fails |
| Prisma validate fails | Invalid schema syntax | Run `npx prisma validate` locally; check field types and relations |
| Prisma format fails | Schema not formatted | Run `npx prisma format` on the schema file |
| Playwright fails | Browser test regression | Run `npm run test:e2e` locally; check `playwright-report/` for traces |
| Spam detection flags your PR | PR description too short or generic | Write a detailed description with at least 30 characters explaining what and why |

### Code Review Guidelines

When reviewing a PR, maintainers check for:
- Does the change match the issue description and acceptance criteria?
- Are there sufficient tests covering the new code paths?
- Do the tests use the project's established mocking patterns?
- Are edge cases handled (empty states, error states, boundary conditions)?
- Does the change introduce any new dependencies?
- Does the change follow the project's coding style and conventions?
- Are security considerations addressed (input validation, SSRF prevention, auth checks)?
- Is the diff minimal — does it only change what's needed?

Contributors should self-review their code against these same criteria before requesting review.

### PR Quality Gates

Every PR must pass the following checks before it can be merged:

1. **All CI checks pass** — Test Platform (lint, typecheck, build, unit tests), Prisma Schema Check, and Worker Consistency (if applicable)
2. **Code review approval** — At least one maintainer must review and approve
3. **No merge conflicts** — The PR must be mergeable into `main`
4. **Linked issue** — The PR description must reference the issue it resolves
5. **GSSoC spam check passes** — The PR must not be flagged as spam or AI-generated

### Workflow Configuration Best Practices

When modifying or adding GitHub Actions workflows, follow these conventions established in this codebase:

- **Use `actions/checkout@v4`** consistently across all workflows for repository checkout. Avoid mixing `@v4` and `@v6` as this creates inconsistency
- **Always include `cache: npm`** in `actions/setup-node@v4` steps when `npm install` or `npm ci` is used later in the workflow. This speeds up consecutive runs by caching `node_modules`
- **Use explicit step names** (`- name: Install dependencies`) rather than anonymous steps (`- run: npm ci`). Named steps produce clearer output in the GitHub Actions log
- **Set `concurrency` groups** on workflows that run per-PR to automatically cancel stale runs when a new commit is pushed
- **Use `secrets.GITHUB_TOKEN`** for GitHub API calls within workflows. The token is automatically scoped to the repository and workflow
- **Pin action versions** by major version (e.g., `@v4` not `@latest`) to avoid unexpected breaking changes from action updates
- **Use `if:` conditions** on steps that should only run for specific events or outcomes (e.g., `if: failure()` for notification steps)
- **Set job-level `timeout-minutes`** for workflows that could run indefinitely (e.g., Playwright tests with 60-minute timeout)
- **Add `workflow_dispatch`** trigger to scheduled workflows to allow manual triggering for testing and recovery

### Testing Your Workflow Changes

If you modify any CI workflow, verify your changes before pushing:

1. Use `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/<file>.yml'))"` to validate YAML syntax locally
2. Check that all action versions referenced in the workflow exist and are compatible
3. Verify that all `secrets.*` references are defined in the repository settings
4. Test the workflow by pushing to a branch — GitHub Actions will parse and run the workflow automatically
5. Check the workflow run logs for any deprecation warnings or configuration errors

> To check CI status for your PR, look for the check results at the bottom of the PR page on GitHub. Click any failing check to view the detailed log.

If you encounter any issues not covered in this guide, please open a GitHub Discussion or reach out in the issue comments. The maintainers and community are here to help.

Thank you again for contributing and helping make GitVerse Next.js awesome! 🚀
