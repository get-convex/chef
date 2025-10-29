# Testing the E-Commerce Template Fix

## ✅ Fix Applied

- Removed duplicate `template/ecommerce/` folder
- Cleaned up empty `ecommerce/` subdirectories
- Regenerated snapshot: `template-snapshot-6259ade8.bin` (132KB, 40 files)

## 🚨 CRITICAL: Must Start Fresh Chat

**The error you're seeing is from an OLD CHAT that loaded the OLD SNAPSHOT with duplicate files.**

### Why This Happens

1. When you start a chat, it loads a snapshot into WebContainer
2. The snapshot is **cached in the Convex database** for that chat
3. Reloading the page uses the **same cached snapshot**
4. You MUST create a **NEW chat** to load the new snapshot

## Testing Steps

### Option 1: Create New Chat (Recommended)

1. **Stop the dev server** (Ctrl+C in both terminals)
2. **Restart the servers:**
   ```bash
   pnpm run dev
   # In another terminal:
   npx convex dev
   ```
3. **Open Chef in browser:** http://127.0.0.1:5173
4. **Click "New Chat" button** (or navigate to home and start fresh)
5. **Wait for initialization** (should see "Ready" status)
6. **Test with:** "Show me the e-commerce features"

### Option 2: Delete Old Chat

If you want to keep your chat history but fix the snapshot:

1. Note your current chat ID from the URL (e.g., `chat/abc123`)
2. Delete the chat from the sidebar
3. Create a new chat

### Option 3: Clear Browser Cache (Nuclear Option)

1. Open DevTools (F12)
2. Right-click the refresh button → "Empty Cache and Hard Reload"
3. Clear IndexedDB for localhost
4. Create new chat

## Verification Checklist

When you start a new chat, check the browser console:

### ✅ Success Indicators

```
Container boot [XXXms] LOADING_SNAPSHOT
Container boot [XXXms] DOWNLOADING_DEPENDENCIES
Copying 40 files to temp directory    ← Should be 40, not 74!
NPM output: ...
Container boot [XXXms] READY
```

### ✅ No Convex Errors

The error should NOT appear:
```
✘ [ERROR] Two output files share the same path
```

### ✅ Files Loaded

In browser console:
```javascript
// Check loaded files
workbenchStore.files.get()
// Should show /home/project/convex/products.ts, etc.
// Should NOT show /home/project/ecommerce/...
```

## Test Prompts

Once the new chat loads successfully, try these:

### 1. View Existing Files
```
"Show me the product management features"
```

**Expected:** Agent uses `view` tool to show `convex/products.ts`

### 2. Make a Small Change
```
"Add a 'category' field to the products table"
```

**Expected:** Agent uses `view` then `edit` tool on `convex/schema.ts`

### 3. Add New Feature
```
"Add product search functionality to the homepage"
```

**Expected:** Agent edits existing `HomePage.tsx` and possibly creates a search component

## Troubleshooting

### Still Getting Duplicate File Error?

**Check which snapshot is loaded:**
```bash
# In browser DevTools Console
localStorage.getItem('chatId')  // Get your chat ID

# Then check if it's using old snapshot
# Look in Network tab for template-snapshot-*.bin
# Should be: template-snapshot-6259ade8.bin
```

**If it's loading an old snapshot:**
- You're in an old chat
- Create a NEW chat (don't reload existing one)

### Snapshot Not Updating?

```bash
# Check latest snapshot
ls -lh public/template-snapshot-6259ade8.bin

# Should show ~132KB created recently
```

### Still Seeing Old Files?

```bash
# Verify template is clean
ls template/ecommerce        # Should not exist
ls template/convex/ecommerce # Should not exist
ls template/src/*/ecommerce  # Should not exist

# Check git
git status template/
# Should show no ecommerce files
```

## Current State Summary

### Template Structure (Correct)
```
template/
├── convex/
│   ├── products.ts ✅
│   ├── cart.ts ✅
│   └── ... (9 files total)
├── src/
│   ├── pages/
│   │   ├── HomePage.tsx ✅
│   │   └── ... (4 files)
│   └── components/
│       ├── Navbar.tsx ✅
│       └── ProductCard.tsx ✅
└── package.json ✅

NO ecommerce/ folders anywhere ✅
```

### Snapshot
- **File:** `template-snapshot-6259ade8.bin`
- **Size:** 132KB
- **Files:** 40
- **No duplicates:** ✅

### Configuration
- **TEMPLATE_URL:** Updated to new snapshot ✅
- **PREWARM_PATHS:** Points to root files ✅
- **System Prompts:** Instructs agent about existing files ✅

## Next Steps After Success

Once the new chat works:

1. **Test agent behavior** with various prompts
2. **Verify edit tool** is used for modifications
3. **Confirm no file recreation** from scratch
4. **Check Convex deploys** successfully

## Developer Notes

**For future template changes:**

1. Modify files in `template/` (not subdirectories)
2. Run `node make-bootstrap-snapshot.js`
3. Commit changes including new snapshot
4. **Always test with NEW chat** after snapshot changes

**Remember:**
- Old chats = Old snapshots (cached in DB)
- New chats = New snapshot (from latest TEMPLATE_URL)
- Can't "upgrade" existing chat to new snapshot easily
