# Google OAuth Setup Guide

This guide explains how to set up Google OAuth 2.0 for GitVerse to enable Google sign-in functionality.

## Prerequisites

- A Google Cloud Platform (GCP) account
- Access to the [Google Cloud Console](https://console.cloud.google.com/)

## Step 1: Create or Select a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top of the page
3. Click **New Project** or select an existing project
4. Enter a project name (e.g., "GitVerse")
5. Click **Create**

## Step 2: Enable Required APIs

1. In the Google Cloud Console, navigate to **APIs & Services** > **Library**
2. Search for and enable the following APIs:
   - **Google People API** (recommended for profile information)
   - **Google Identity** (for authentication)

> **Note:** The deprecated Google+ API is no longer available. Use Google People API for user profile data instead.

## Step 3: Configure OAuth Consent Screen

1. Navigate to **APIs & Services** > **OAuth consent screen**
2. Select **External** user type (unless you have a Google Workspace organization)
3. Click **Create**
4. Fill in the required fields:
   - **App name**: GitVerse (or your application name)
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
5. Click **Save and Continue**
6. On the **Scopes** page, click **Add or Remove Scopes** and add:
   - `openid`
   - `email`
   - `profile`
7. Click **Save and Continue**
8. On the **Test users** page, add test user email addresses (if in testing mode)
9. Click **Save and Continue**
10. Review your settings and click **Back to Dashboard**

## Step 4: Create OAuth 2.0 Credentials

1. Navigate to **APIs & Services** > **Credentials**
2. Click **+ Create Credentials** > **OAuth client ID**
3. Select **Web application** as the application type
4. Enter a name (e.g., "GitVerse Web Client")
5. Under **Authorized redirect URIs**, add:
   - For local development: `http://localhost:3000/api/auth/callback/google`
   - For production: `https://your-domain.com/api/auth/callback/google`
6. Click **Create**
7. Copy the **Client ID** and **Client Secret**

## Step 5: Configure Environment Variables

Add the following environment variables to your `.env.local` file (for local development) or your hosting platform's environment settings:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret
```

### For Vercel Deployment

```bash
# Using Vercel CLI
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET
vercel env add NEXTAUTH_SECRET
```

### For Firebase App Hosting

```bash
firebase apphosting:secrets:set google-client-id
firebase apphosting:secrets:set google-client-secret
```

## Step 6: Update OAuth Consent Screen for Production

Before deploying to production, you must publish your OAuth consent screen:

1. Go to **APIs & Services** > **OAuth consent screen**
2. Click **Publish App**
3. Confirm the action

> **Important:** If you don't publish the app, only test users can sign in with Google.

## Troubleshooting

### Common Issues

#### 1. "redirect_uri_mismatch" Error

**Cause:** The redirect URI in your Google Cloud Console doesn't match your application's callback URL.

**Solution:**
- Verify the redirect URI in Google Cloud Console matches exactly:
  - Local: `http://localhost:3000/api/auth/callback/google`
  - Production: `https://your-domain.com/api/auth/callback/google`
- Ensure `NEXTAUTH_URL` is set correctly in your environment variables

#### 2. "Access Not Configured" Error

**Cause:** Required APIs are not enabled in your Google Cloud project.

**Solution:**
- Enable Google People API and Google Identity in **APIs & Services** > **Library**

#### 3. "Invalid Client" Error

**Cause:** Incorrect Client ID or Client Secret.

**Solution:**
- Double-check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` environment variables
- Ensure there are no extra spaces or characters

#### 4. Users Cannot Sign In (Testing Mode)

**Cause:** OAuth consent screen is in testing mode.

**Solution:**
- Add user emails to the test users list, OR
- Publish the OAuth consent screen for production use

### Verifying Your Configuration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to the login page and click "Sign in with Google"

3. Check the browser's developer console for any errors

4. Check your server logs for authentication-related messages

## Security Best Practices

1. **Never commit secrets to version control**
   - Use `.env.local` for local development
   - Use environment variables in production

2. **Keep Client Secret secure**
   - Never expose it in client-side code
   - Rotate secrets if compromised

3. **Use HTTPS in production**
   - Google OAuth requires HTTPS for production redirect URIs

4. **Validate tokens server-side**
   - Always verify Google ID tokens on your server (already implemented in `lib/auth-config.ts`)

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)
- [NextAuth.js Google Provider](https://next-auth.js.org/providers/google)
- [Google People API](https://developers.google.com/people)

## Support

If you encounter issues not covered here, please:
1. Check the [GitVerse GitHub Issues](https://github.com/nisshchayarathi/gitverse-nextjs/issues)
2. Create a new issue with the label `bug` or `question`
3. Include relevant error messages and your configuration (without secrets)
