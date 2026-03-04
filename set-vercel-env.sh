#!/bin/bash
# Script to set Vercel environment variables for Chef production deployment
# Run this after linking your Vercel project with: vercel link

set -e  # Exit on error

echo "🚀 Setting Vercel environment variables for production..."
echo ""

# Read values from .env.local
if [ ! -f .env.local ]; then
  echo "❌ Error: .env.local file not found!"
  echo "Please create .env.local with your environment variables first."
  exit 1
fi

echo "📋 Reading configuration from .env.local..."
source .env.local

# Helper function to set env var for production and preview
set_env() {
  local key=$1
  local value=$2

  if [ -z "$value" ]; then
    echo "⚠️  Skipping $key (not set in .env.local)"
    return
  fi

  echo "Setting $key..."
  echo "$value" | vercel env add "$key" production preview > /dev/null 2>&1 || echo "  (already exists or error)"
}

echo ""
echo "⚙️  Setting Convex configuration..."
set_env "CONVEX_DEPLOYMENT" "$CONVEX_DEPLOYMENT"
set_env "CONVEX_URL" "$CONVEX_URL"
set_env "CONVEX_DEPLOYMENT_URL" "$CONVEX_DEPLOYMENT_URL"
set_env "CONVEX_SITE_URL" "$CONVEX_SITE_URL"
set_env "CONVEX_DEPLOYMENT_KEY" "$CONVEX_DEPLOYMENT_KEY"

echo ""
echo "🔐 Setting Google OAuth credentials..."
set_env "GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_ID"
set_env "GOOGLE_CLIENT_SECRET" "$GOOGLE_CLIENT_SECRET"

echo ""
echo "🔑 Setting Convex OAuth credentials..."
set_env "CONVEX_OAUTH_CLIENT_ID" "$CONVEX_OAUTH_CLIENT_ID"
set_env "CONVEX_OAUTH_CLIENT_SECRET" "$CONVEX_OAUTH_CLIENT_SECRET"
set_env "VITE_CONVEX_OAUTH_CLIENT_ID" "$VITE_CONVEX_OAUTH_CLIENT_ID"

echo ""
echo "👥 Setting Convex team configuration..."
set_env "VITE_DEFAULT_TEAM_SLUG" "$VITE_DEFAULT_TEAM_SLUG"

echo ""
echo "🤖 Setting AI provider API keys (optional)..."
set_env "ANTHROPIC_API_KEY" "$ANTHROPIC_API_KEY"
set_env "OPENAI_API_KEY" "$OPENAI_API_KEY"
set_env "XAI_API_KEY" "$XAI_API_KEY"
set_env "GOOGLE_API_KEY" "$GOOGLE_API_KEY"
set_env "GOOGLE_VERTEX_CREDENTIALS_JSON" "$GOOGLE_VERTEX_CREDENTIALS_JSON"

echo ""
echo "📊 Setting analytics and feature flags..."
set_env "VITE_POSTHOG_HOST" "${VITE_POSTHOG_HOST:-https://us.i.posthog.com}"
set_env "VITE_POSTHOG_KEY" "$VITE_POSTHOG_KEY"
set_env "VITE_LD_CLIENT_SIDE_ID" "$VITE_LD_CLIENT_SIDE_ID"
set_env "DISABLE_USAGE_REPORTING" "1"
set_env "DISABLE_BEDROCK" "1"

echo ""
echo "✅ Environment variables setup complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Verify variables in Vercel dashboard: https://vercel.com/dashboard"
echo "  2. Update OAuth redirect URIs to include your Vercel domain"
echo "  3. Deploy: vercel --prod"
echo ""
echo "🔗 Don't forget to update redirect URIs:"
echo "  - Google OAuth: https://console.cloud.google.com/apis/credentials"
echo "  - Add: https://your-app.vercel.app/api/auth/google/callback"
echo "  - Add: https://your-app.vercel.app/api/convex/dashboard/callback"
echo ""
