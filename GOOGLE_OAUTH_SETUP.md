# Google OAuth Setup Guide

This guide will help you set up Google OAuth authentication for GitVerse.

## Prerequisites

- A Google Cloud Platform account
- Access to the GitVerse project

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project ID

## Step 2: Enable Google+ API

1. In your Google Cloud Console, navigate to **APIs & Services** > **Library**
2. Search for "Google+ API" and enable it
3. Also enable "Google Identity" APIs if available

## Step 3: Configure OAuth Consent Screen

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

## Step 4: Create OAuth 2.0 Credentials

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

## Step 5: Configure Environment Variables

1. Open your `.env.local` file (or create one from `.env.example`)
2. Add the following variables:

```env
# NextAuth Configuration
NEXTAUTH_SECRET=<generate-a-random-secret-here>
NEXTAUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
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

3. Click the "Sign in with Google" button

4. You should be redirected to Google's authentication page

5. After successful authentication, you'll be redirected back to your dashboard

## Production Deployment

When deploying to production:

1. Update `NEXTAUTH_URL` to your production URL
2. Add your production URL to Google Cloud Console:
   - Authorized JavaScript origins
   - Authorized redirect URIs
3. Ensure all environment variables are set in your production environment
4. Run the database migration in production

## Provider Rate Limits & Retry Strategies

When GitVerse integrates with third-party providers (like GitHub or Google), it natively handles rate limiting and transient failures to ensure robust operation.

### Rate Limit Behavior (HTTP 429)

If a provider returns a `429 Too Many Requests` response, GitVerse will safely catch the error and surface a standardized response to the client. The frontend will typically display a message like:
`"Rate limit reached. Please retry after X seconds."`

GitVerse extracts the `retryAfter` or reset timing directly from the provider's HTTP headers and propagates it safely without exposing internal API responses.

### Retry with Exponential Backoff

For transient network failures or safe server errors (e.g., `502`, `503`, `504`), GitVerse employs an automatic exponential backoff mechanism.

**Retry Flow Example:**
- Attempt 1: Immediate Execution
- Attempt 2: 1s delay
- Attempt 3: 2s delay
- Attempt 4: 4s delay

This prevents infinite retry loops and respects provider rate limits while improving overall system reliability.

## Secure Logging Practices

To protect sensitive information, GitVerse enforces strict token sanitization requirements across all provider integrations:

1. **Token Redaction:** Never log raw OAuth access tokens, `Authorization` headers, or provider credentials.
2. **Error Sanitization:** If an HTTP fetch fails, the underlying `AxiosError` or `fetch` error is sanitized to strip out sensitive config and request headers before it reaches `console.error`.
3. **Safe Debugging:** Logs will output the HTTP status code, safe message strings, and endpoint paths (excluding query string secrets) to preserve debuggability without compromising security.

## Troubleshooting

### Error: "redirect_uri_mismatch"

- Ensure the redirect URI in Google Cloud Console exactly matches: `{NEXTAUTH_URL}/api/auth/callback/google`
- Check for trailing slashes - they matter!
- Verify the protocol (http vs https)

### Error: "Access blocked: This app's request is invalid"

- Make sure you've configured the OAuth consent screen
- Add your email as a test user if using external user type
- Ensure the required scopes are added

### Users can't sign in

- Check that the Google+ API is enabled
- Verify environment variables are loaded correctly
- Check the browser console and server logs for error messages

### Database errors

- Run `npx prisma generate` to regenerate the Prisma client
- Ensure the migration ran successfully
- Check your DATABASE_URL is correct

## Features

The Google OAuth integration includes:

- **Sign in with Google**: Users can authenticate using their Google account
- **Account Linking**: If a user with the same email exists, the Google account is linked
- **Avatar Sync**: User avatars from Google are automatically synced
- **Dual Auth Support**: Both email/password and Google OAuth work seamlessly together
- **Secure Sessions**: Uses NextAuth.js with JWT strategy for secure session management

## Security Best Practices

1. **Never commit** your `.env.local` file or expose your credentials
2. Use strong, randomly generated secrets for `NEXTAUTH_SECRET`
3. Keep your OAuth credentials secure
4. Regularly rotate secrets in production
5. Monitor OAuth access in Google Cloud Console
6. Set up proper CORS and CSP headers for production
7. Use HTTPS in production (required by Google OAuth)

## Additional Resources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)
