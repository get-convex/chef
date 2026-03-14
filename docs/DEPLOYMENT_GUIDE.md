# Chef Deployment Guide

## Overview
This project has three environments to configure:
1. **Local Development** (.env.local) - Already configured
2. **Convex Backend** (Convex Dashboard) - Backend environment variables
3. **Vercel Frontend** (Vercel Dashboard) - Frontend/runtime environment variables

---

## 1. CONVEX BACKEND SETUP

Go to your Convex Dashboard → Production Deployment → Environment Variables
Add the following:

### Required Backend Variables

```env
# Big Brain Host (Convex API)
BIG_BRAIN_HOST=https://api.convex.dev

# OAuth Configuration (for Convex Auth)
CONVEX_OAUTH_CLIENT_ID=<from_your_convex_oauth_app>
CONVEX_OAUTH_CLIENT_SECRET=<from_your_convex_oauth_app>
```

### Optional: If using Google Vertex AI Service Account

```env
GOOGLE_VERTEX_CREDENTIALS_JSON={"type":"service_account","project_id":"...","private_key":"..."}
```

**Note:** These are backend-only secrets that your Convex functions need. They are NOT exposed to the frontend.

---

## 2. VERCEL FRONTEND SETUP

In Vercel Dashboard → Your Project → Settings → Environment Variables
Add the following for **Production**:

### Required Frontend Variables

```env
# Convex Connection
CONVEX_URL=https://striped-dalmatian-762.convex.site
VITE_CONVEX_URL=https://striped-dalmatian-762.convex.site

# AI Model Providers (at least one required)
GOOGLE_API_KEY=<your_google_api_key>
GEMINI_API_KEY=<your_google_api_key>
OPENAI_API_KEY=<your_openai_api_key>

# Vertex AI (if using)
VERTEX_AI_STUDIO_API_KEY=<your_vertex_ai_key>

# Optional: Anthropic (when you add it)
ANTHROPIC_API_KEY=
```

### Optional Analytics

```env
VITE_POSTHOG_HOST=https://us.i.posthog.com
VITE_POSTHOG_KEY=phc_NWQlkY67cr90RUzVIpgz67chtiz719ApjWj3HCoJ4nD
```

### Feature Flags

```env
DISABLE_USAGE_REPORTING=1
DISABLE_BEDROCK=1
```

---

## 3. AUTHENTICATION SETUP

You mentioned using **Google Auth or Convex Auth with OTP**. Based on your screenshot, you already have Convex OIDC configured.

### Current Setup (from your screenshot):
- Domain: `https://striped-dalmatian-762.convex.site`
- Application ID: `convex`
- Type: OIDC provider

### No Additional Variables Needed for Auth
Since you're using Convex's built-in auth and NOT WorkOS, you don't need to add any WorkOS-related variables.

---

## 4. DEPLOYMENT STEPS

### Step 1: Deploy Convex Backend to Production
```bash
npx convex deploy --prod
```

This will give you your production Convex URL (e.g., `https://striped-dalmatian-762.convex.site`)

### Step 2: Add Environment Variables to Convex
Go to Convex Dashboard and add the backend variables listed in Section 1.

### Step 3: Build Locally (Optional - Test Build)
```bash
pnpm run build
```

### Step 4: Deploy to Vercel

**Option A: Using Vercel CLI**
```bash
vercel --prod
```

**Option B: Using Vercel GitHub Integration** (Recommended)
1. Connect your GitHub repo to Vercel
2. Add all environment variables from Section 2 in Vercel Dashboard
3. Push to main branch - auto-deploys

### Step 5: Update Production URLs
After Vercel deployment, update these if needed:
- Convex OAuth redirect URIs to point to your Vercel domain
- Any CORS settings in Convex

---

## 5. ENVIRONMENT VARIABLES SUMMARY

### What Goes Where?

| Variable | .env.local | Convex | Vercel |
|----------|-----------|---------|---------|
| CONVEX_URL | ✅ | ❌ | ✅ |
| VITE_CONVEX_URL | ✅ | ❌ | ✅ |
| GOOGLE_API_KEY | ✅ | ❌ | ✅ |
| GEMINI_API_KEY | ✅ | ❌ | ✅ |
| ANTHROPIC_API_KEY | ✅ | ❌ | ✅ |
| OPENAI_API_KEY | ✅ | ❌ | ✅ |
| VERTEX_AI_STUDIO_API_KEY | ✅ | ❌ | ✅ |
| GOOGLE_VERTEX_CREDENTIALS_JSON | ✅ | ✅* | ❌ |
| BIG_BRAIN_HOST | ❌ | ✅ | ❌ |
| CONVEX_OAUTH_CLIENT_ID | ❌ | ✅ | ❌ |
| CONVEX_OAUTH_CLIENT_SECRET | ❌ | ✅ | ❌ |
| VITE_POSTHOG_* | ✅ | ❌ | ✅ |

*Only if using Vertex AI Service Account for backend operations

---

## 6. GOOGLE VERTEX AI SERVICE ACCOUNT

If you need to format your Google Vertex AI service account JSON:

1. Download your service account JSON file from Google Cloud Console
2. Format it as a **single line** (remove all newlines)
3. Escape the newlines in the private key with `\n`

**Example:**
```json
{"type":"service_account","project_id":"my-project","private_key_id":"abc123","private_key":"-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n","client_email":"service@my-project.iam.gserviceaccount.com","client_id":"123456","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/service%40my-project.iam.gserviceaccount.com"}
```

---

## 7. VERIFICATION CHECKLIST

After deployment:

- [ ] Convex backend is deployed to production
- [ ] Convex environment variables are set
- [ ] Vercel environment variables are set
- [ ] Build completes successfully
- [ ] App is accessible at Vercel URL
- [ ] Authentication works (Google/Convex Auth)
- [ ] AI code generation works with Google API
- [ ] No console errors in browser

---

## Need Help?

If you encounter issues:
1. Check Convex logs in dashboard
2. Check Vercel deployment logs
3. Verify all environment variables are set correctly
4. Ensure API keys are valid and have proper permissions
