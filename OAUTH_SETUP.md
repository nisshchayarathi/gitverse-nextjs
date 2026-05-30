# OAuth Setup Guide

This guide will help you set up OAuth authentication (Google and GitHub) for GitVerse.

## Prerequisites

- A Google Cloud Platform account (for Google OAuth)
- A GitHub account (for GitHub OAuth)
- Access to the GitVerse project

---

## 🔵 Google OAuth Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project ID

### Step 2: Enable Google+ API

1. In your Google Cloud Console, navigate to **APIs & Services** > **Library**
2. Search for "Google+ API" and enable it
3. Also enable "Google Identity" APIs if available

### Step 3: Configure OAuth Consent Screen

1. Navigate to **APIs & Services** > **OAuth consent screen**
2. Choose **External** user type (or Internal if you're using Google Workspace)
3. Fill in the required fields:
   - **App name**: GitVerse
   - **User support email**: Your email
   - **Developer contact email**: Your email
4. Add scopes:
   - `userinfo.email`
   - `userinfo.profile`
   - `openid`
5. Add test users (if using external type during development)
6. Save and continue

### Step 4: Create OAuth 2.0 Credentials

1. Navigate to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Select **Web application** as the application type
4. Configure:
   - **Name**: GitVerse Web Client
   - **Authorized JavaScript origins**:
     - `http://localhost:3000` (for development)
     - Your production URL (e.g., `https://gitverse.yourdomain.com`)
   - **Authorized redirect URIs**:
     - `http://localhost:3000/api/auth/callback/google` (for development)
     - `https://gitverse.yourdomain.com/api/auth/callback/google` (for production)
5. Click **Create**
6. Copy the **Client ID** and **Client Secret**

---

## ⚫ GitHub OAuth Setup

### Step 1: Register a new GitHub OAuth App

1. Go to your GitHub account **Settings**
2. Navigate to **Developer settings** > **OAuth Apps**
3. Click **New OAuth App**
4. Configure:
   - **Application name**: GitVerse
   - **Homepage URL**: `http://localhost:3000` (or your production URL)
   - **Authorization callback URL**:
     - `http://localhost:3000/api/auth/callback/github` (for development)
     - `https://gitverse.yourdomain.com/api/auth/callback/github` (for production)
5. Click **Register application**

### Step 2: Get your Client ID and Client Secret

1. Once registered, you will see your **Client ID** on the app's settings page
2. Click **Generate a new client secret** to create your **Client Secret**
3. Copy both the Client ID and Client Secret

---

## Step 5: Configure Environment Variables

1. Open your `.env.local` file (or create one from `.env.example`)
2. Add the following variables based on the providers you set up:

```env
# NextAuth Configuration
NEXTAUTH_SECRET=<generate-a-random-secret-here>
NEXTAUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### Generating NEXTAUTH_SECRET

Run this command to generate a secure random secret:

```bash
openssl rand -base64 32
```

Or use this Node.js command:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Step 6: Run Database Migrations

The OAuth support requires new database tables. Run the migration:

```bash
npm run prisma:migrate
```

Or if the migration already ran:

```bash
npx prisma generate
```

## Step 7: Test the Integration

1. Start your development server:

   ```bash
   npm run dev
   ```

2. Navigate to http://localhost:3000/login

3. Click the "Sign in with Google" or "Sign in with GitHub" button

4. You should be redirected to the respective authentication page

5. After successful authentication, you'll be redirected back to your dashboard

## Production Deployment

When deploying to production:

1. Update `NEXTAUTH_URL` to your production URL
2. Add your production URL to Google Cloud Console and GitHub Developer Settings:
   - Authorized JavaScript origins (Google) / Homepage URL (GitHub)
   - Authorized redirect URIs
3. Ensure all environment variables are set in your production environment
4. Run the database migration in production

## Troubleshooting

### Error: "redirect_uri_mismatch"

- Ensure the redirect URI in the OAuth provider's settings exactly matches: `{NEXTAUTH_URL}/api/auth/callback/{provider}`
- Check for trailing slashes - they matter!
- Verify the protocol (http vs https)

### Users can't sign in

- Verify environment variables are loaded correctly
- Check the browser console and server logs for error messages

### Database errors

- Run `npx prisma generate` to regenerate the Prisma client
- Ensure the migration ran successfully
- Check your DATABASE_URL is correct

## Features

The OAuth integration includes:

- **Multiple Providers**: Users can authenticate using Google or GitHub
- **Account Linking**: If a user with the same email exists, the OAuth account is linked
- **Avatar Sync**: User avatars are automatically synced
- **Dual Auth Support**: Both email/password and OAuth work seamlessly together
- **Secure Sessions**: Uses NextAuth.js with JWT strategy for secure session management
