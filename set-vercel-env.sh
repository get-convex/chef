#!/bin/bash
# Script to set Vercel environment variables
# Run this after linking your Vercel project

echo "Setting Vercel environment variables for production..."

# Convex Connection
vercel env add CONVEX_URL production <<< "https://striped-dalmatian-762.convex.cloud"
vercel env add VITE_CONVEX_URL production <<< "https://striped-dalmatian-762.convex.cloud"

# AI Model Providers (replace with your actual keys)
# vercel env add GOOGLE_API_KEY production <<< "your_google_api_key"
# vercel env add GEMINI_API_KEY production <<< "your_gemini_api_key"
# vercel env add VERTEX_AI_STUDIO_API_KEY production <<< "your_vertex_ai_key"
# vercel env add OPENAI_API_KEY production <<< "your_openai_api_key"

# Analytics
vercel env add VITE_POSTHOG_HOST production <<< "https://us.i.posthog.com"
vercel env add VITE_POSTHOG_KEY production <<< "phc_NWQlkY67cr90RUzVIpgz67chtiz719ApjWj3HCoJ4nD"

# Feature Flags
vercel env add DISABLE_USAGE_REPORTING production <<< "1"
vercel env add DISABLE_BEDROCK production <<< "1"

echo ""
echo "✅ Environment variables set for production!"
echo ""
echo "Note: You still need to set these manually in Vercel dashboard:"
echo "  - CONVEX_OAUTH_CLIENT_ID (if needed for OAuth callback route)"
echo "  - CONVEX_OAUTH_CLIENT_SECRET (if needed for OAuth callback route)"
echo "  - ANTHROPIC_API_KEY (when you get it)"
