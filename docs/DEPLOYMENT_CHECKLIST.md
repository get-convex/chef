# Deployment Checklist

## ✅ Step 1: Convex Backend Environment Variables

Go to: **Convex Dashboard → Production Deployment → Settings → Environment Variables**

Add these variables:

```env
BIG_BRAIN_HOST=https://api.convex.dev
CONVEX_APPLICATION_ID=convex
GOOGLE_CLIENT_ID=<your_google_client_id>
GOOGLE_CLIENT_SECRET=<your_google_client_secret>
```

**Note**: These are already set in your DEV deployment. For PROD, run:
```bash
npx convex deploy --prod
# Then add the same variables in the Production deployment dashboard
```

**Optional** - Only if you need Vertex AI on the backend:
```env
GOOGLE_VERTEX_CREDENTIALS_JSON=<your_service_account_json>
```

---

## ✅ Step 2: Vercel Environment Variables

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

Set these for **Production** environment:

### Core Configuration
```env
CONVEX_URL=https://gallant-cod-201.convex.cloud
VITE_CONVEX_URL=https://gallant-cod-201.convex.cloud
```

### AI Model Providers (Primary: Google)
```env
GOOGLE_API_KEY=<your_google_api_key>
GEMINI_API_KEY=<your_gemini_api_key>
VERTEX_AI_STUDIO_API_KEY=<your_vertex_ai_key>
```

### Secondary AI Providers
```env
OPENAI_API_KEY=<your_openai_api_key>
```

Add when you get Anthropic key:
```env
ANTHROPIC_API_KEY=<your_anthropic_key_here>
```

### Analytics (Optional)
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

## 📋 Summary

### What Goes Where:

| Variable | Local (.env.local) | Convex Dashboard | Vercel Dashboard |
|----------|-------------------|------------------|------------------|
| CONVEX_URL | ✅ | ❌ | ✅ |
| VITE_CONVEX_URL | ✅ | ❌ | ✅ |
| BIG_BRAIN_HOST | ✅ | ✅ | ❌ |
| CONVEX_APPLICATION_ID | ✅ | ✅ | ❌ |
| GOOGLE_CLIENT_ID | ✅ | ✅ | ❌ |
| GOOGLE_CLIENT_SECRET | ✅ | ✅ | ❌ |
| GOOGLE_API_KEY | ✅ | ❌ | ✅ |
| GEMINI_API_KEY | ✅ | ❌ | ✅ |
| ANTHROPIC_API_KEY | ✅ | ❌ | ✅ |
| OPENAI_API_KEY | ✅ | ❌ | ✅ |
| VERTEX_AI_STUDIO_API_KEY | ✅ | ❌ | ✅ |
| VERTEX_AI_SERVICE_ACCOUNT | ✅ | ✅ (optional) | ❌ |
| VITE_POSTHOG_* | ✅ | ❌ | ✅ |
| DISABLE_* flags | ✅ | ❌ | ✅ |

---

## 🚀 Deployment Commands

1. **Deploy Convex Backend:**
   ```bash
   npx convex deploy --prod
   ```

2. **Build Project (test locally):**
   ```bash
   pnpm run build
   ```

3. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

   OR connect GitHub repo and push to main branch

---

## ✅ Final Verification

After deployment, verify:

- [ ] Convex environment variables are set
- [ ] Vercel environment variables are set
- [ ] App builds successfully
- [ ] App loads at Vercel URL
- [ ] Authentication works (Google/Convex Auth)
- [ ] AI code generation works
- [ ] No errors in browser console
- [ ] No errors in Vercel logs

---

## 🔐 Security Notes

- ✅ Never commit `.env.local` to git
- ✅ Rotate API keys if accidentally exposed
- ✅ Use Vercel's environment variable encryption
- ✅ Limit API key permissions in provider dashboards
