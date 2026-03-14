# Vercel Production Setup Guide

This guide will help you deploy your Chef app to Vercel with your production Convex account.

## Prerequisites

1. Your Convex production deployment URL and key
2. Google OAuth credentials
3. Convex OAuth app credentials (Client ID: `1414b799becd4195`)
4. Vercel CLI installed: `npm i -g vercel`

## Step 1: Set Up Local Convex Development

Run Convex in development mode to test locally:

```bash
npm run convex:dev
```

This will connect to your Convex deployment specified in `.env.local`.

## Step 2: Configure Vercel Environment Variables

You need to set the following environment variables in Vercel. You can do this either:
- Via the Vercel dashboard (Settings → Environment Variables)
- Or using the Vercel CLI (recommended)

### Required Environment Variables

#### Convex Configuration
```bash
# Your production Convex deployment
vercel env add CONVEX_DEPLOYMENT
# Example: prod:striped-dalmatian-762

vercel env add CONVEX_URL
# Example: https://striped-dalmatian-762.convex.cloud

vercel env add CONVEX_DEPLOYMENT_URL
# Example: https://striped-dalmatian-762.convex.cloud

vercel env add CONVEX_SITE_URL
# Example: https://striped-dalmatian-762.convex.site

vercel env add CONVEX_DEPLOYMENT_KEY
# Your production deployment key (starts with prod:)
# Example: prod:striped-dalmatian-762|eyJ...
```

#### Google OAuth Configuration
```bash
vercel env add GOOGLE_CLIENT_ID
# Example: 561957498361-0f9mtcp25437nifbss26eei9a1b8rm6o.apps.googleusercontent.com

vercel env add GOOGLE_CLIENT_SECRET
# Your Google OAuth client secret
```

#### Convex OAuth Configuration (for Chef features)
```bash
vercel env add CONVEX_OAUTH_CLIENT_ID
# Example: 1414b799becd4195

vercel env add CONVEX_OAUTH_CLIENT_SECRET
# Example: 94cda5d59c5b495c88aa9f0138823206

vercel env add VITE_CONVEX_OAUTH_CLIENT_ID
# Example: 1414b799becd4195
```

#### Optional: AI Provider API Keys
```bash
# Set at least one of these for AI features:
vercel env add ANTHROPIC_API_KEY
vercel env add OPENAI_API_KEY
vercel env add XAI_API_KEY
vercel env add GOOGLE_API_KEY
```

### Environment Scope

When adding each variable, select:
- **Production** ✓
- **Preview** ✓ (optional, for preview deployments)
- **Development** (optional, local dev already uses .env.local)

## Step 3: Automated Script (Alternative)

Use the provided script to set all environment variables at once:

```bash
chmod +x set-vercel-env.sh
./set-vercel-env.sh
```

**Note**: Edit the script first to replace placeholder values with your actual credentials.

## Step 4: Deploy to Vercel

```bash
# Link to your Vercel project (first time only)
vercel link

# Deploy to production
vercel --prod
```

## Step 5: Update OAuth Redirect URIs

After deployment, update your OAuth redirect URIs:

### Google OAuth Console
1. Go to https://console.cloud.google.com/apis/credentials
2. Edit your OAuth 2.0 Client
3. Add to **Authorized redirect URIs**:
   - `https://your-app.vercel.app/api/auth/google/callback`

### Convex Dashboard (for OAuth app)
1. Go to your Convex OAuth app settings
2. Add to redirect URIs:
   - `https://your-app.vercel.app/api/convex/dashboard/callback`

## Step 6: Verify Deployment

1. Visit your deployed app: `https://your-app.vercel.app`
2. Sign in with Google - should work
3. Check that Convex projects can be created
4. Monitor Vercel logs for any errors

## Troubleshooting

### 401 Errors on Dashboard APIs
This is expected! Third-party OAuth apps don't have access to Convex dashboard APIs. The app now uses:
- Personal team auto-creation (no dashboard API needed)
- Direct project creation via OAuth
- Local usage tracking (no dashboard quota checks)

### Missing Environment Variables
Check Vercel deployment logs:
```bash
vercel logs --prod
```

Look for errors like "Missing CONVEX_DEPLOYMENT" or "Missing GOOGLE_CLIENT_SECRET"

### OAuth Redirect Errors
- Ensure redirect URIs exactly match your deployment URL
- No trailing slashes
- Use HTTPS in production

## Schema Migration

Your production Convex schema is already set up. No migration needed - the schema you provided matches the codebase schema.

## Local Development

For local development, keep using `.env.local`:
```bash
npm run dev          # Remix dev server
npm run convex:dev   # Convex dev (in separate terminal)
```

## Continuous Deployment

Once set up, Vercel will automatically deploy:
- **Production**: When you push to `main` branch
- **Preview**: When you create pull requests

Convex deployment is handled separately via the deployment key.
