# GitVerse Next.js - Quick Start Guide

This is the Next.js version of GitVerse, migrated from the Vite + React version with 100% feature parity.

## Prerequisites

- **Node.js 22.x** (see [Supported Node Version](README.md#supported-node-version) in README)
- PostgreSQL database (NeonDB recommended)
- Google Gemini AI API key

## Setup Steps

### 1. Install Dependencies

```bash
cd gitverse-nextjs
npm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your values:

```env
# Database - Get from https://neon.tech
DATABASE_URL=postgresql://user:password@host/database?sslmode=require&schema=public

# JWT Secret - Generate a secure random string
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Gemini AI - Get from https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here

# NextAuth (required for Google login)
# For local dev:
NEXTAUTH_URL=http://localhost:3000
# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET=your-nextauth-secret
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Optional: Base URL for API calls
# Leave unset to use same-origin `/api/...` (recommended).
# If you set it, avoid a trailing slash (e.g. https://example.com, not https://example.com/)
# NEXT_PUBLIC_API_URL=http://localhost:3000
```

**Important:** Copy `.env.local` to `.env` for Prisma CLI:

```bash
cp .env.local .env
```

### 3. Set Up Database

Generate Prisma client:

```bash
npm run prisma:generate
```

Run migrations:

```bash
npm run prisma:migrate
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## What's Different from the Vite Version?

### Architecture Changes

1. **Routing**: React Router → Next.js App Router
2. **API**: Express server → Next.js API Routes
3. **Environment**: Vite env (VITE*) → Next.js env (NEXT_PUBLIC*)
4. **Build**: Vite → Next.js build system

### File Structure

- `/app` - Next.js App Router pages and API routes
- `/app/api` - API endpoints (replaces `/server` folder)
- `/src/components` - React components (same as before)
- `/src/pages` - Page components (wrapped by App Router)
- `/lib` - Server-side utilities and services

### Key Files

- `app/layout.tsx` - Root layout with providers
- `app/page.tsx` - Home page (Landing)
- `app/api/*/route.ts` - API endpoints
- `next.config.js` - Next.js configuration
- `middleware.ts` - Optional route middleware

## Development

### Running the App

```bash
npm run dev          # Development server
npm run build        # Production build
npm start            # Production server
npm run lint         # Lint code
```

### Database Management

```bash
npm run prisma:studio    # Open Prisma Studio (DB GUI)
npm run prisma:generate  # Regenerate Prisma client
npm run prisma:migrate   # Run migrations
```

## API Endpoints

All endpoints are prefixed with `/api`:

### Authentication

- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Repositories

- `GET /api/repositories` - List user's repositories
- `POST /api/repositories` - Create/import repository
- `GET /api/repositories/[id]` - Get repository details
- `DELETE /api/repositories/[id]` - Delete repository
- `GET /api/repositories/[id]/stats` - Get repository stats
- `POST /api/repositories/[id]/analyze` - Analyze repository

### AI Features

- `POST /api/ai/analyze-repository` - AI repository analysis
- `POST /api/ai/analyze-code` - AI code analysis
- `POST /api/ai/chat` - Chat with AI about repository
- `POST /api/ai/suggest-commit` - Generate commit messages

### User Management

- `GET /api/users/me` - Get user profile
- `PUT /api/users/profile` - Update profile
- `POST /api/users/change-password` - Change password

### Integrations

- `POST /api/integrations/github/*` - GitHub integration
- `POST /api/integrations/gitlab/*` - GitLab integration
- `POST /api/integrations/bitbucket/*` - Bitbucket integration

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import in Vercel dashboard
3. Add environment variables
4. Deploy automatically

### Docker

```bash
docker build -t gitverse-nextjs .
docker run -p 3000:3000 gitverse-nextjs
```

### Manual Deployment

```bash
npm run build
npm start
```

## Troubleshooting

### "Module not found" errors

```bash
npm install
npm run prisma:generate
```

### Database connection issues

- Check your DATABASE_URL in `.env.local`
- Ensure your database is accessible
- Try running migrations: `npm run prisma:migrate`

### Build errors

- Clear Next.js cache: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`

## Features Checklist

✅ User Authentication (JWT)
✅ Repository Import & Analysis
✅ Branch Visualization
✅ Commit History
✅ Contributor Analysis
✅ Language Detection
✅ AI-Powered Insights
✅ Code Analysis
✅ GitHub/GitLab/Bitbucket Integration
✅ Responsive Design
✅ Dark Mode Support

## Support

For issues or questions:

- Check the main README.md
- Review Next.js documentation
- Open an issue on GitHub

---

**Note**: This is a complete migration of the original Vite project to Next.js. All features and UI remain identical.


## Setting Up GitHub App (for PR Reviews)

### Step 1: Create a GitHub App

1. Go to **GitHub → Settings → Developer settings → GitHub Apps**
2. Click **New GitHub App**
3. Fill in:
   - **App name:** `gitverse-your-username` (must be unique)
   - **Homepage URL:** `https://your-app.vercel.app`
   - **Webhook URL:** `https://your-app.vercel.app/api/webhooks/github`
   - **Webhook secret:** Generate any random string — save it as `GITHUB_WEBHOOK_SECRET`
4. Set **Permissions:**
   - Pull requests → **Read & Write**
   - Contents → **Read only**
   - Issues → **Read & Write**
5. Click **Create GitHub App**

### Step 2: Get Your Credentials

After creating the app:

- Copy **App ID** → save as `GITHUB_APP_ID`
- Copy **App slug** (from the URL) → save as `GITHUB_APP_SLUG`
- Scroll down → click **Generate a private key** → downloads a `.pem` file

### Step 3: Format the Private Key

**For local `.env.local`:**
```bash
# Open the .pem file and copy its contents
# Replace actual newlines with \n — paste as a single line:
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----"
```

**For Vercel:**
1. Open the `.pem` file in a text editor
2. Copy the **entire content** (including BEGIN/END lines)
3. In Vercel Dashboard → Environment Variables → paste as-is (Vercel handles multiline automatically)

### Step 4: Install the App on Your Repo

1. Go to your GitHub App → **Install App**
2. Select your repository
3. Click **Install**

---

## Troubleshooting: GitHub App Issues

### Webhook not receiving events
- Check that `GITHUB_WEBHOOK_SECRET` matches exactly what you set in GitHub App settings
- Check logs at: **Vercel Dashboard → Functions → Logs**

### "Bad credentials" error
- `GITHUB_APP_PRIVATE_KEY` format is incorrect — ensure `\n` is a literal backslash-n, not an actual newline
- `GITHUB_APP_ID` must contain numeric digits only — do not add extra quotes or spaces

### Private key error on Vercel
- When pasting in Vercel, copy the **entire content** of the `.pem` file
- The full PEM block must be preserved — header may be `-----BEGIN RSA PRIVATE KEY-----` or `-----BEGIN PRIVATE KEY-----` depending on your key format