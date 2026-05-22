# GitVerse

Turn any GitHub repo into an interactive map of its architecture, modules, and risks.

GitVerse is built for the moment you open a new codebase and ask: “Where do I start?”

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

## Getting Started

The canonical onboarding and setup guide is:

- [GETTING_STARTED.md](./GETTING_STARTED.md)

Additional setup docs:

- [START_HERE.md](./START_HERE.md)
- [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md)
- [GOOGLE_OAUTH_INTEGRATION.md](./GOOGLE_OAUTH_INTEGRATION.md)
- [QUICKSTART_OAUTH.md](./QUICKSTART_OAUTH.md)

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

## 🧩 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run Next.js linter
- `npm run format` - Format code with Prettier
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio

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

1. Push your code to GitHub.
2. Import the project in the [Vercel dashboard](https://vercel.com/new).
3. Under **Settings → Environment Variables**, add every variable listed in the [Environment Variables](#-environment-variables) section below. Vercel automatically makes them available at build time and runtime.
   - For `NEXTAUTH_URL`, set the value to your Vercel deployment URL (e.g. `https://gitverse.vercel.app`). In local development, set it to `http://localhost:3000` in your `.env.local` to avoid missing-URL warnings.
   - Mark sensitive secrets (e.g. `JWT_SECRET`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`) as **Sensitive** in Vercel so they are never exposed in logs.
4. Click **Deploy**.

> **Tip:** Vercel re-deploys automatically on every push to `main`. If you update an environment variable in the dashboard, trigger a redeploy from **Deployments → Redeploy** for the new value to take effect.

### Docker

```bash
docker build -t gitverse-nextjs .
docker run -p 3000:3000 \
  -e DATABASE_URL="..." \
  -e JWT_SECRET="..." \
  -e GEMINI_API_KEY="..." \
  gitverse-nextjs
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

## 📝 Environment Variables

Copy `.env.example` to `.env.local` and fill in the values before starting the dev server:

```bash
cp .env.example .env.local
```

> **Never commit `.env.local` or any file containing real secrets.** It is already listed in `.gitignore`.

### Required Variables

| Variable | Description | How to obtain |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string (with SSL) | Create a free database on [Neon](https://neon.tech) → **Connection Details** → copy the connection string. Append `?sslmode=require&schema=public` if not already present. |
| `JWT_SECRET` | Secret used to sign custom JWT tokens | Generate with `openssl rand -base64 32` or any random string ≥ 32 characters. |
| `GEMINI_API_KEY` | Google Gemini API key for AI features | Go to [Google AI Studio](https://aistudio.google.com/app/apikey) → **Create API key**. |

### OAuth / NextAuth Variables

| Variable | Description | How to obtain |
| :--- | :--- | :--- |
| `NEXTAUTH_URL` | Canonical base URL of your deployment | Set to `http://localhost:3000` in development. On Vercel, set to your deployment URL (e.g. `https://gitverse.vercel.app`). |
| `NEXTAUTH_SECRET` | Secret used to sign NextAuth session tokens | Generate with `openssl rand -base64 32`. Must be a strong random string. |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID | [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Credentials → Create Credentials → OAuth client ID** (Web application). |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret | Obtained alongside `GOOGLE_CLIENT_ID` in the same step above. |

### GitHub App Configuration

GitVerse integrates heavily with GitHub via a GitHub App to read repositories, post PR reviews, and track issues. 

**Required GitHub App Permissions & Scopes:**
To ensure full functionality, your GitHub App must be granted the following repository-level permissions:
- **Contents:** Read-only (Required to fetch source code for AI analysis)
- **Metadata:** Read-only (Mandatory basic read access for all GitHub Apps)
- **Pull requests:** Read & Write (Required to read PR diffs and post review comments)
- **Issues:** Read & Write (Required for tracking and commenting on issues)

**Required Webhook Events:**
- `Pull request` (Fires when PRs are opened or updated, triggering the AI review service)

| Variable | Description & Usage | How to obtain |
| :--- | :--- | :--- |
| `GITHUB_APP_ID` | Numeric ID of your GitHub App. Used to authenticate API requests as the App. | [GitHub Developer Settings](https://github.com/settings/apps) → create or open your App → copy **App ID**. |
| `GITHUB_APP_PRIVATE_KEY` | RSA private key. Used to sign JWTs for GitHub API authentication. | In your GitHub App settings → **Generate a private key** → paste contents with literal `\n` line breaks. |
| `GITHUB_APP_SLUG` | URL slug of your GitHub App. Used to generate installation URLs. | The part after `github.com/apps/` in the App's public URL. |
| `GITHUB_WEBHOOK_SECRET` | Secret string. Used to verify that incoming webhook payloads genuinely came from GitHub. | Set any strong random string here and enter the same value in your GitHub App's webhook configuration. |

**Local Development Setup for GitHub Apps:**
1. Create a GitHub App in your developer settings.
2. Use a service like ngrok (`ngrok http 3000`) to expose your local server.
3. Set your App's Webhook URL to `https://<your-ngrok-url>/api/webhooks/github`.
4. Add the App credentials to `.env.local`.

### Optional Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Base URL for client-side API calls | Current domain (e.g. `http://localhost:3000`) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API key (App Hosting only) | Not required for local dev or Vercel |
| `GITHUB_APP_STATE_SECRET` | Additional signing secret for OAuth state | Falls back to `NEXTAUTH_SECRET` if unset |

### Google OAuth Redirect URIs

Add these **Authorized redirect URIs** in Google Cloud Console → **OAuth client**:

| Environment | URI |
| :--- | :--- |
| Local dev | `http://localhost:3000/api/auth/callback/google` |
| Vercel | `https://<your-domain>/api/auth/callback/google` |

---

## 🛠️ Troubleshooting

### `Error: PrismaClientInitializationError` / Cannot connect to database

**Cause:** `DATABASE_URL` is missing, malformed, or the database is unreachable.

**Fix:**
1. Verify `.env.local` contains `DATABASE_URL` and the value is correct.
2. Ensure your Neon database is not paused (Neon free-tier databases sleep after inactivity — open the Neon console to wake it).
3. Confirm the connection string includes `?sslmode=require`.
4. Run `npm run prisma:generate` followed by `npm run prisma:migrate` after any schema change.

### `[next-auth][error][OAUTH_CALLBACK_ERROR]` during Google Sign-In

**Cause:** `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, or `GOOGLE_CLIENT_SECRET` is wrong, or the redirect URI is not registered in Google Cloud Console.

**Fix:**
1. Double-check `NEXTAUTH_URL` matches the origin you are accessing (including protocol and port).
2. In Google Cloud Console → **OAuth client** → **Authorized redirect URIs**, ensure `<NEXTAUTH_URL>/api/auth/callback/google` is listed.
3. On Vercel, set `NEXTAUTH_URL` to the exact deployment URL (no trailing slash).

### `Error: NEXTAUTH_SECRET is not set`

**Cause:** `NEXTAUTH_SECRET` is missing from the environment.

**Fix:** Generate a secret and add it to `.env.local`:

```bash
openssl rand -base64 32
```

On Vercel, add it under **Settings → Environment Variables**.

### AI features return `500` / Gemini errors

**Cause:** `GEMINI_API_KEY` is missing or invalid.

**Fix:**
1. Confirm `GEMINI_API_KEY` is set in `.env.local`.
2. Verify the key is active in [Google AI Studio](https://aistudio.google.com/app/apikey).
3. Check that the Gemini API is enabled for your Google Cloud project.

### Environment variables not picked up after editing `.env.local`

**Fix:** Restart the development server — Next.js reads `.env.local` only at startup:

```bash
# Stop the server (Ctrl+C), then:
npm run dev
```

On Vercel, trigger a redeploy (**Deployments → ⋯ → Redeploy**) after changing any environment variable in the dashboard.

### `prisma:migrate` fails with `P3009` or migration drift

**Cause:** Local database is out of sync with the migration history.

**Fix (development only — do not run in production):**

```bash
npx prisma migrate reset
npm run prisma:migrate
```

### Port 3000 already in use

**Fix:** Kill the process using port 3000, or start on a different port:

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS / Linux
lsof -ti:3000 | xargs kill -9

# Or run on a different port
npm run dev -- -p 3001
```

### Build fails on Vercel with `Type error` or missing module

**Fix:**
1. Ensure all required environment variables are set in the Vercel dashboard — missing vars can cause build-time type errors.
2. Run `npm run build` locally first to catch errors before pushing.
3. Check that your Node.js version in Vercel matches the one used locally (see `engines` in `package.json`).

### GitHub App Integration Issues

**Symptoms:** PR reviews aren't posting, repo analysis fails, or webhook errors.

**Fix:**
- **Missing GitHub App Credentials:** Ensure `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and other related variables are correctly populated in your `.env.local` or Vercel environment settings. Without these, PR reviews and repository analysis will fail. Build or deployment failures caused by missing secrets are usually flagged during the `npm run build` step.
- **Invalid GitHub App IDs:** Ensure your `GITHUB_APP_ID` is a numeric string (not the client ID or slug).
- **Incorrect Callback URLs:** Ensure the webhook URL in the GitHub App settings exactly matches your deployed domain's endpoint (e.g., `https://<your-domain>/api/webhooks/github`).
- **Permission Denied / API Access Errors:** Verify your GitHub App has the exact permissions listed in the [GitHub App Configuration](#github-app-configuration) section (especially Read/Write on Pull Requests and Read on Contents). If you updated permissions on an existing App, you must accept the new permissions on your App installations.
- **Vercel Deployment / Environment Setup Issues:** In Vercel, format the `GITHUB_APP_PRIVATE_KEY` correctly. Sometimes newlines get mangled during copy-pasting. Enclosing the key in double quotes in the Vercel dashboard or ensuring literal `\n` characters are used can prevent parsing errors.
- **Authentication/Session Failures:** If `next-auth` sessions fail to read the GitHub token, ensure `NEXTAUTH_SECRET` is set and matches across your infrastructure.

### Error-Handling Guidance for Developers

When extending the GitHub integration or building new features, follow these error-handling practices:

- **Detecting Missing Env Vars:** At application startup or within route handlers, explicitly check for `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY`. If missing, log a clear warning and gracefully disable the GitHub-dependent features instead of crashing the server or UI.
- **Safe API Validation:** Always wrap `githubService` or `octokit` calls in `try/catch` blocks. If `octokit.request` throws a `403 Forbidden` or `404 Not Found` (which often indicates a permission issue or missing repository access), handle it cleanly by returning a `403` or `404` JSON response with a safe, descriptive error string (e.g., `"Repository access denied. Check GitHub App permissions."`).
- **Runtime Failure Behavior:** Ensure webhooks respond with a `200 OK` quickly, even if the internal AI analysis fails or throws an error. If you return a `500` to GitHub synchronously, they may disable your webhook after repeated failures. Use background jobs (like the analysis worker) or isolated error logging for the actual processing step.
- **Common Integration Mistakes:** The most frequent developer mistake is forgetting to accept new permissions on the GitHub App installation after updating them in the App settings. Always remind users to navigate to their installation settings to approve permission scope changes.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- Vercel for hosting solutions
- Google for Gemini AI
- NeonDB for serverless PostgreSQL
- All contributors and users of GitVerse



Made with ❤️ by the GitVerse Team
