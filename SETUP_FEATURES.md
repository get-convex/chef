# Chef Features Setup Guide

This guide covers the setup for the three new features added to Chef:

## 1. API Key Management via UI ✅

**Already implemented** - The settings page now shows all supported providers:
- Anthropic (Claude)
- Google (Gemini)
- OpenAI (GPT)
- xAI (Grok)

Users can add, view, and remove API keys through the UI at `/settings`.

## 2. GitHub Integration 🔧

**Setup required:**

1. Create a GitHub OAuth App:
   - Go to GitHub Settings → Developer settings → OAuth Apps
   - Click "New OAuth App"
   - Set Authorization callback URL to: `http://127.0.0.1:5173/settings`

2. Update environment variables in `.env.local`:
   ```
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   VITE_APP_URL=http://127.0.0.1:5173
   ```

3. Deploy Convex functions:
   ```bash
   npx convex dev
   ```

## 3. Unified Backend/Frontend ✅

**Already implemented** - The app serves both frontend and backend from a single URL:
- Frontend: React/Remix app
- Backend: Convex functions for API keys and GitHub integration
- All accessible from `http://127.0.0.1:5173`

## Usage

1. Start the development server:
   ```bash
   pnpm run dev
   npx convex dev  # in another terminal
   ```

2. Visit `http://127.0.0.1:5173/settings` to:
   - Manage API keys for all supported providers
   - Connect GitHub account and browse repositories
   - Configure other settings

## Files Modified/Created

- `convex/schema.ts` - Added GitHub integration schema
- `convex/github.ts` - GitHub integration backend functions
- `app/routes/api.github.oauth.ts` - GitHub OAuth handler
- `app/components/settings/GitHubCard.tsx` - GitHub UI component
- `app/components/SettingsContent.client.tsx` - Updated settings page
- `app/components/settings/ApiKeyCard.tsx` - Enhanced API key management
