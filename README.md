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

> **Paste a repo. Understand it in minutes.**

GitVerse turns any GitHub repository into an interactive visual map of its architecture, modules, and risk hotspots — so you always know where to start.

Whether you're a new contributor facing an unfamiliar codebase, or a maintainer trying to communicate structure to your team, GitVerse gives you the full picture instantly.

</div>

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
- `npm run db:seed` - Seed the database with mock data

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



---

Made with ❤️ by the GitVerse Team
