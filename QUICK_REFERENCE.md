# Chef E-Commerce Template - Quick Reference

## ✅ Problem Fixed

**Before:** Agent created e-commerce files from scratch  
**After:** Agent recognizes and edits existing template files

## 🔧 What Was Changed

| File | What Changed | Why |
|------|--------------|-----|
| `public/template-snapshot-885ee88c.bin` | New snapshot with e-commerce files | Agent loads from this snapshot |
| `app/lib/stores/startup/useContainerSetup.ts` | Updated TEMPLATE_URL | Points to new snapshot |
| `chef-agent/prompts/solutionConstraints.ts` | Added `<ecommerce_only>` instructions | Tells agent files exist |
| `chef-agent/constants.ts` | Updated PREWARM_PATHS (15 files) | Agent sees these files immediately |
| `chef-agent/constants.ts` | Updated SUGGESTIONS | Better user prompts |

## 📁 Template Structure

```
/home/project/ (in WebContainer)
├── convex/
│   ├── schema.ts       ✅ Products, cart, orders, roles tables
│   ├── products.ts     ✅ CRUD operations
│   ├── cart.ts         ✅ Add/remove/update cart items
│   ├── orders.ts       ✅ Checkout & order history
│   ├── roles.ts        ✅ RBAC (admin/user)
│   ├── router.ts       ✅ HTTP routes
│   ├── auth.ts         🔒 LOCKED - Don't modify
│   └── http.ts         🔒 LOCKED - Don't modify
│
├── src/
│   ├── pages/
│   │   ├── HomePage.tsx          ✅ Product listing
│   │   ├── CartPage.tsx          ✅ Shopping cart
│   │   ├── OrdersPage.tsx        ✅ Order history
│   │   └── AdminDashboard.tsx    ✅ Admin panel
│   ├── components/
│   │   ├── Navbar.tsx            ✅ Navigation
│   │   └── ProductCard.tsx       ✅ Product display
│   ├── App.tsx                   ✅ Routing
│   ├── main.tsx                  🔒 LOCKED - Don't modify
│   ├── SignInForm.tsx            🔒 LOCKED - Don't modify
│   └── SignOutButton.tsx         🔒 LOCKED - Don't modify
│
└── package.json                  🔒 Modified via npmInstall tool only
```

## 🚀 How Agent Now Works

### 1. Snapshot Load (on new chat)
```
WebContainer.mount(template-snapshot-885ee88c.bin)
  └── Contains all 74 e-commerce files
  └── Mounted at /home/project/
```

### 2. File Prewarming
```
prewarmWorkdir()
  └── Loads 15 files from PREWARM_PATHS
  └── Agent can see these immediately
```

### 3. Context Building
```
ChatContextManager.relevantFiles()
  └── PREWARM_PATHS files (priority)
  └── Recently edited files
  └── Current open file
  └── Max 16 files total
```

### 4. Agent Response
```
User: "Build e-commerce store"
Agent: 
  1. Reads <ecommerce_only> instructions
  2. Sees files marked "ALREADY EXISTS"
  3. Uses `view` tool to show existing code
  4. Suggests customizations
  ✅ Does NOT recreate from scratch
```

## 🔄 When to Rebuild Snapshot

```bash
# Rebuild snapshot after:
# - Adding new files to template/
# - Modifying existing template files
# - Updating dependencies

cd template
npm install  # Ensure package-lock.json is current
cd ..
node make-bootstrap-snapshot.js
```

**Result:**
- Creates new `template-snapshot-XXXXXXXX.bin`
- Updates `TEMPLATE_URL` in `useContainerSetup.ts`
- ~30 seconds to complete

## 📝 Key Configuration Files

### PREWARM_PATHS (15 files preloaded)
```typescript
// chef-agent/constants.ts
export const PREWARM_PATHS = [
  '/home/project/package.json',
  '/home/project/convex/schema.ts',
  '/home/project/convex/products.ts',
  '/home/project/convex/cart.ts',
  '/home/project/convex/orders.ts',
  '/home/project/convex/roles.ts',
  '/home/project/convex/router.ts',
  '/home/project/src/App.tsx',
  '/home/project/src/pages/HomePage.tsx',
  '/home/project/src/pages/CartPage.tsx',
  '/home/project/src/pages/OrdersPage.tsx',
  '/home/project/src/pages/AdminDashboard.tsx',
  '/home/project/src/components/Navbar.tsx',
  '/home/project/src/components/ProductCard.tsx',
  '/home/project/src/index.css',
];
```

### EXCLUDED_FILE_PATHS (7 locked files)
```typescript
// chef-agent/constants.ts
export const EXCLUDED_FILE_PATHS = [
  'convex/auth.ts',          // Auth config
  'convex/http.ts',          // HTTP handlers
  'src/main.tsx',            // App entry
  'src/SignInForm.tsx',      // Auth UI
  'src/SignOutButton.tsx',   // Auth UI
  'vite.config.ts',          // Vite config
  'package.json',            // Dependencies
];
```

## 🎯 User Workflow

### Initial Setup (after sign-in)
```bash
# 1. Grant admin privileges
npx convex run roles:seedMyAdmin

# 2. Access Admin Dashboard (via navbar)

# 3. Create products

# 4. Shop as regular user
```

### Suggested User Prompts
1. "Show me what's implemented and help me customize"
2. "Add product categories to filter products"
3. "Add search functionality to the product page"

## 🐛 Debugging

### Check Snapshot is Loaded
```javascript
// Browser console
chefWebContainer  // Should show WebContainer instance
chefWebContainer.fs.readdir('/home/project')  // Lists files
```

### Check Prewarmed Files
```javascript
// Browser console
workbenchStore.files.get()  // Shows all loaded files
```

### Check Agent Context
```javascript
// Browser console
chefMessages  // Raw chat messages
chefParsedMessages  // Parsed with file context
```

### Enable Debug Logging
```javascript
// Browser console
chefSetLogLevel('debug')  // More detailed logs
```

## 📊 Success Indicators

✅ **New snapshot created:**
```bash
ls -lh public/template-snapshot-885ee88c.bin
# Should show ~177KB file
```

✅ **Agent uses view tool:**
```
User: "Show products page"
Agent: *calls view tool on src/pages/HomePage.tsx*
Agent: *shows existing code*
```

✅ **Agent uses edit tool:**
```
User: "Add a subtitle to product cards"
Agent: *calls view tool first*
Agent: *calls edit tool with specific text replacement*
```

✅ **Agent doesn't recreate:**
```
User: "Build e-commerce store"
Agent: "This environment already has a complete e-commerce store..."
Agent: *uses view tool to show existing files*
```

## 🔗 Quick Links

- **Full Details:** [SOLUTION_SUMMARY.md](./SOLUTION_SUMMARY.md)
- **E-Commerce Template:** [template/ecommerce/README.md](./template/ecommerce/README.md)
- **Chef Setup:** [README.md](./README.md)
- **Development:** [DEVELOPMENT.md](./DEVELOPMENT.md)

## 🆘 Common Issues

### "Agent still creates files from scratch"
```bash
# Check snapshot URL
grep TEMPLATE_URL app/lib/stores/startup/useContainerSetup.ts
# Should show: template-snapshot-885ee88c.bin

# Rebuild snapshot
node make-bootstrap-snapshot.js
```

### "Files not showing in editor"
```bash
# Restart dev server
# Check browser console for errors
# Verify snapshot loaded (should see "Copying 74 files")
```

### "Changes to template not reflected"
```bash
# Must rebuild snapshot after template changes!
node make-bootstrap-snapshot.js
```

---

**Status:** ✅ Fixed  
**Snapshot:** template-snapshot-885ee88c.bin (177KB)  
**Files Prewarmed:** 15  
**Files Locked:** 7  
**Last Updated:** October 27, 2025




```chatReference::memory
[{"id":"0c656cd8-ec3a-4353-8a0c-83ba478aae69","title":"AI Agent File Handling Fix"},{"id":"1ecc159c-ccf5-476f-a3dd-2a3c5a9ac59f","title":"AI App Generator Template Configuration"},{"id":"4205ad60-ce1d-4c8d-9349-4d69c0f1c0e4","title":"Agent Constants File Integration"},{"id":"4dfe7cd2-ec5f-4563-a33f-8da403312662","title":"WebContainer Path Configuration and Constants Integration"},{"id":"a5280f2f-ce67-4cde-ba06-f95d5bdecc63","title":"Agent Prompt Configuration Pattern"},{"id":"ef20a5ab-9386-4d0e-80c4-c74c85e0e9e8","title":"Solution Constraints String Escaping Requirement"},{"id":"e4478bb0-8652-4ca7-84d1-8a32c7960c38","title":"Environment Configuration"},{"id":"0a83c8f7-7184-4738-9b06-c3107553fe95","title":"Project Configuration"},{"id":"ddb0fbe5-f393-4d12-b63b-02a583efe334","title":"Project Introduction and Structure"},{"id":"573d13a6-17a2-488e-83e7-52012dd2f21c","title":"Project Tech Stack"},{"id":"ff884df9-a4a0-4302-9e24-0d81526acbc8","title":"Styling Technology Decision"}]
```

Great question! Let me clarify how the snapshot system works.

## Answer: The Snapshot Works on the **Entire Template Folder**

The snapshot captures the **whole `template/` folder**, not just the `template/ecommerce/` subfolder.

```toolCall::read_file
```

## How It Works

Looking at the snapshot script:

```javascript
const inputDir = 'template';  // ← Points to entire template folder
const absoluteInputDir = path.resolve(inputDir);
```

The script:
1. **Scans the entire `template/` directory** (line 13)
2. Uses `git ls-files` to get all tracked files
3. Copies **everything** git tracks, including subdirectories

## What Gets Included

When you ran the snapshot, the output showed:

```
Copying 74 files to temp directory...
Copying .gitignore
Copying components.json
Copying convex/products.ts          ← From template/convex/
Copying ecommerce/README.md         ← From template/ecommerce/
Copying ecommerce/convex/products.ts ← Also from template/ecommerce/
Copying src/App.tsx                 ← From template/src/
...
```

## Current Template Structure

Your `template/` folder currently has this structure:

```
template/
├── convex/              ← ✅ Active e-commerce files (used by agent)
│   ├── products.ts
│   ├── cart.ts
│   └── ...
├── src/                 ← ✅ Active e-commerce files (used by agent)
│   ├── pages/
│   └── components/
├── ecommerce/           ← ⚠️ Backup/reference copy
│   ├── convex/
│   └── src/
└── package.json
```

## What the Agent Actually Uses

When the WebContainer loads the snapshot, it mounts **everything** at `/home/project/`:

```
/home/project/
├── convex/              ← Agent uses these (from template/convex/)
├── src/                 ← Agent uses these (from template/src/)
├── ecommerce/           ← Also included but not used by agent
└── package.json
```

However, your **PREWARM_PATHS** points to the root-level files:

```typescript
export const PREWARM_PATHS = [
  `${WORK_DIR}/convex/products.ts`,        // ← /home/project/convex/products.ts
  `${WORK_DIR}/src/pages/HomePage.tsx`,    // ← /home/project/src/pages/HomePage.tsx
  // NOT /home/project/ecommerce/convex/products.ts
];
```

## Recommendation

You have **duplicate files**:
- `template/convex/` (active - agent uses these)
- `template/ecommerce/convex/` (backup - unused)

### Option 1: Keep Only Active Files ✅ Recommended
```bash
# Remove the backup folder to reduce snapshot size
rm -rf template/ecommerce/

# Rebuild snapshot
node make-bootstrap-snapshot.js
```

This will reduce your snapshot from 177KB to ~120KB and avoid confusion.

### Option 2: Keep Both (Current State)
If you want to keep `ecommerce/` as a reference backup, that's fine. The snapshot will include it, but the agent won't use it unless you update PREWARM_PATHS.

## Summary

- ✅ **Snapshot captures**: Entire `template/` folder (all subdirectories)
- ✅ **Agent uses**: Files at root level (`template/convex/`, `template/src/`)
- ⚠️ **Agent ignores**: `template/ecommerce/` subfolder (not in PREWARM_PATHS)
- 📦 **Current snapshot size**: 177KB (includes both active + backup files)

The `template/ecommerce/` folder is essentially dead weight in your snapshot right now - it's included but never referenced by the agent.