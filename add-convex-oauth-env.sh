#!/bin/bash
# Add Convex OAuth environment variables to Vercel

echo "🔧 Adding Convex OAuth environment variables to Vercel..."
echo ""

# Add for production
echo "Setting for PRODUCTION..."
vercel env add CONVEX_OAUTH_CLIENT_ID production <<< "1414b799becd4195"
vercel env add CONVEX_OAUTH_CLIENT_SECRET production <<< "94cda5d59c5b495c88aa9f0138823206"
vercel env add VITE_CONVEX_OAUTH_CLIENT_ID production <<< "1414b799becd4195"
vercel env add VITE_CONVEX_SITE_URL production <<< "https://striped-dalmatian-762.convex.site"

# Add for preview
echo ""
echo "Setting for PREVIEW..."
vercel env add CONVEX_OAUTH_CLIENT_ID preview <<< "1414b799becd4195"
vercel env add CONVEX_OAUTH_CLIENT_SECRET preview <<< "94cda5d59c5b495c88aa9f0138823206"
vercel env add VITE_CONVEX_OAUTH_CLIENT_ID preview <<< "1414b799becd4195"
vercel env add VITE_CONVEX_SITE_URL preview <<< "https://striped-dalmatian-762.convex.site"

# Add for development
echo ""
echo "Setting for DEVELOPMENT..."
vercel env add CONVEX_OAUTH_CLIENT_ID development <<< "1414b799becd4195"
vercel env add CONVEX_OAUTH_CLIENT_SECRET development <<< "94cda5d59c5b495c88aa9f0138823206"
vercel env add VITE_CONVEX_OAUTH_CLIENT_ID development <<< "1414b799becd4195"
vercel env add VITE_CONVEX_SITE_URL development <<< "https://striped-dalmatian-762.convex.site"

echo ""
echo "✅ Done! Convex OAuth environment variables added to all environments."
echo "   Now trigger a new deployment for changes to take effect:"
echo "   git commit --allow-empty -m 'Trigger redeploy for Convex OAuth env vars'"
echo "   git push"
