# Google OAuth Setup Complete

## ✅ What We've Done

### 1. Updated Convex Auth Configuration
- Modified `convex/auth.config.ts` to use Convex OIDC provider instead of WorkOS
- Configured to work with your existing Convex Auth setup from the dashboard

### 2. Set Development Environment Variables in Convex
Added to your **dev deployment (gallant-cod-201)**:
```env
CONVEX_APPLICATION_ID=convex
BIG_BRAIN_HOST=https://api.convex.dev
GOOGLE_CLIENT_ID=<your_google_client_id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your_google_client_secret>
```

### 3. Current Authentication Flow
Your app is now configured to use:
- **Convex Auth** with **Google OAuth** as the provider
- The OIDC provider "convex" that you set up in your dashboard
- No more dependency on WorkOS

---

## 🔧 What Still Needs to Be Done

### Issue: Frontend Code Still Uses WorkOS
The React components in your app still import and use `@workos-inc/authkit-react`:
- `app/root.tsx` - Uses `AuthKitProvider` and `ConvexProviderWithAuthKit`
- `app/components/UserProvider.tsx` - Uses `useAuth()` from WorkOS
- `app/components/chat/ChefAuthWrapper.tsx` - Uses `getAccessToken()` from WorkOS

### Two Options to Fix This:

#### Option A: Keep Using the Existing Code (Easier)
Since this is a fork of bolt.diy which uses WorkOS, you could:
1. Keep the WorkOS integration in the code
2. Just configure WorkOS to use Google as the auth provider
3. Set up WorkOS environment variables

**Required WorkOS Setup:**
```env
# In .env.local and Vercel
VITE_WORKOS_CLIENT_ID=<your_workos_client_id>
VITE_WORKOS_REDIRECT_URI=<your_production_url>
VITE_WORKOS_API_HOSTNAME=<workos_hostname>

# In Convex Dashboard
WORKOS_CLIENT_ID=<your_workos_client_id>
```

#### Option B: Replace WorkOS with Convex Auth (Requires Code Changes)
Replace the WorkOS auth components with Convex's native auth:
1. Remove `@workos-inc/authkit-react` dependency
2. Update `app/root.tsx` to use Convex's `ConvexProvider` instead of `ConvexProviderWithAuthKit`
3. Update auth components to use Convex auth hooks
4. Implement Google OAuth through Convex Auth

This requires more significant code changes but removes the WorkOS dependency entirely.

---

## 📋 For Production Deployment

### Step 1: Set Up Production Convex Deployment

```bash
npx convex deploy --prod
```

Then add these environment variables in **Convex Dashboard → Production → Environment Variables**:

```env
CONVEX_APPLICATION_ID=convex
BIG_BRAIN_HOST=https://api.convex.dev
GOOGLE_CLIENT_ID=<your_google_client_id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your_google_client_secret>
```

### Step 2: Update Google OAuth Redirect URIs
In Google Cloud Console, add your production URLs to authorized redirect URIs:
- `https://auth.convex.dev/oauth/callback`
- `https://your-vercel-app.vercel.app` (your actual Vercel URL)

### Step 3: Deploy to Vercel

Add these environment variables in **Vercel Dashboard → Settings → Environment Variables**:

```env
# Core
CONVEX_URL=<your_production_convex_url>
VITE_CONVEX_URL=<your_production_convex_url>

# AI Providers (Primary: Google)
GOOGLE_API_KEY=<your_google_api_key>
GEMINI_API_KEY=<your_google_api_key>
VERTEX_AI_STUDIO_API_KEY=<your_vertex_ai_key>

# Secondary AI Providers
OPENAI_API_KEY=<your_openai_key>
ANTHROPIC_API_KEY=<your_anthropic_key_when_ready>

# Analytics (Optional)
VITE_POSTHOG_HOST=https://us.i.posthog.com
VITE_POSTHOG_KEY=phc_NWQlkY67cr90RUzVIpgz67chtiz719ApjWj3HCoJ4nD

# Feature Flags
DISABLE_USAGE_REPORTING=1
DISABLE_BEDROCK=1

# Auth - IF you're keeping WorkOS (see Option A above)
VITE_WORKOS_CLIENT_ID=<if_using_workos>
VITE_WORKOS_REDIRECT_URI=<your_production_url>
VITE_WORKOS_API_HOSTNAME=<workos_hostname>
```

Then deploy:
```bash
vercel --prod
```

---

## 🚨 Current Status

### ✅ Working:
- Convex backend configured for Google OAuth
- Development environment variables set
- No more WORKOS_CLIENT_ID errors in Convex

### ⚠️ Needs Attention:
- Frontend code still has WorkOS dependencies
- Need to choose between Option A (keep WorkOS) or Option B (replace with Convex Auth)
- Production deployment not yet configured

---

## 🎯 Recommended Next Steps

1. **Decide on Auth Strategy**: Choose Option A or B above
2. **Test Locally**: Run `pnpm run dev` and `npx convex dev` to test auth flow
3. **Fix Frontend Issues**: Based on your choice, either configure WorkOS or replace with Convex Auth
4. **Deploy to Production**: Follow the production deployment steps once auth is working locally

---

## 📝 Notes

- Your Google OAuth credentials are already set up
- The Convex OIDC provider "convex" is configured in your dashboard
- Your production deployment is "striped-dalmatian-762"
- You have both dev and prod Convex deployments ready
