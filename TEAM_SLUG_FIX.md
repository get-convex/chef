# Team Slug Fix - Projects Now Go to Correct Team

## What Was Happening

Your Chef app was creating projects under the **wrong team**:
- ❌ Projects were going to: `24hrautollc-personal` (auto-generated from your email)
- ✅ Projects should go to: `ramon-williams` (your production team)

This is why you saw projects in the Convex dashboard under "24hrautollc@gmail.com" team but not under "Ramon Williams's team".

## What I Fixed

1. **Added environment variable support**: The app now respects `VITE_DEFAULT_TEAM_SLUG` to specify which team to use
2. **Updated .env.local**: Added `VITE_DEFAULT_TEAM_SLUG=ramon-williams`
3. **Updated Vercel**: Added the same environment variable to production
4. **Updated deployment script**: `set-vercel-env.sh` now includes the team slug

## How to Apply the Fix

### Option 1: Clear Browser Storage (Easiest)

1. Open your app: https://chef-ramon.vercel.app
2. Open browser DevTools (F12 or Cmd+Option+I)
3. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
4. Under **Local Storage**, click on your domain
5. Find and **delete** these keys:
   - `convex_selected_team_slug`
   - Any keys starting with `convex_team_`
6. **Refresh the page**
7. The app will now use `ramon-williams` as your team!

### Option 2: Use Incognito/Private Window (Quick Test)

1. Open an incognito/private browsing window
2. Go to: https://chef-ramon.vercel.app
3. Sign in with Google
4. Create a new project
5. Check Convex dashboard - it should appear under "Ramon Williams's team"!

### Option 3: Clear All Site Data (Nuclear Option)

1. Go to your app in the browser
2. Open DevTools → Application tab
3. Click "Clear site data" button
4. Confirm and refresh
5. Sign in again

## Verify It's Working

1. Clear localStorage using one of the methods above
2. Sign in to your app
3. Create a new test project
4. Go to Convex dashboard: https://dashboard.convex.dev/t/ramon-williams
5. You should see the new project listed under "Ramon Williams's team"!

## For Local Development

The fix is already applied in `.env.local`:
```bash
VITE_DEFAULT_TEAM_SLUG=ramon-williams
```

Just clear your browser's localStorage and reload the app.

## For Production (Vercel)

Already deployed! The environment variable is set:
```bash
vercel env ls
# You should see: VITE_DEFAULT_TEAM_SLUG = ramon-williams
```

---

## Why This Happened

Third-party OAuth apps (like yours) **cannot access** Convex's dashboard API to fetch your teams. So I implemented a workaround that:
1. Auto-creates a "personal" team for each user
2. Uses their email to generate a team slug
3. But this didn't match your production team "ramon-williams"

Now with `VITE_DEFAULT_TEAM_SLUG`, you explicitly tell the app which team to use!

---

## Next Steps

1. ✅ Clear localStorage (see options above)
2. ✅ Test creating a new project
3. ✅ Verify it appears under "Ramon Williams's team" in Convex
4. 🗑️ Optional: Clean up old projects from "24hrautollc@gmail.com" team

Let me know if projects now appear in the correct team!
