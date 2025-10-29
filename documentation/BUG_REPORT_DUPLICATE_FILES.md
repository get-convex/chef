# Bug Report: Convex Duplicate Output Files Error

## Issue Summary
Persistent "Two output files share the same path but have different contents" error when deploying e-commerce template in WebContainer environment.

## Environment
- **Project**: Chef AI Full-Stack App Builder
- **Component**: E-commerce Template Snapshot
- **Environment**: WebContainer (Browser-based Node.js runtime)
- **Backend**: Convex (Reactive Database & Functions)
- **Affected Files**: storeProducts.ts, storeCart.ts, storeOrders.ts, storeRoles.ts, storeRouter.ts, auth.ts, http.ts

## Error Message
```
✘ [ERROR] Two output files share the same path but have different contents: out/storeProducts.js.map
✘ [ERROR] Two output files share the same path but have different contents: out/storeProducts.js
✘ [ERROR] Two output files share the same path but have different contents: out/storeRoles.js.map
✘ [ERROR] Two output files share the same path but have different contents: out/storeRoles.js
✘ [ERROR] Two output files share the same path but have different contents: out/storeRouter.js.map
✘ [ERROR] Two output files share the same path but have different contents: out/storeRouter.js
✘ [ERROR] Two output files share the same path but have different contents: out/auth.js.map
✘ [ERROR] Two output files share the same path but have different contents: out/auth.js
✘ [ERROR] Two output files share the same path but have different contents: out/http.js.map
✘ [ERROR] Two output files share the same path but have different contents: out/http.js
✘ [ERROR] Two output files share the same path but have different contents: out/storeCart.js.map
✘ [ERROR] Two output files share the same path but have different contents: out/storeCart.js
✘ [ERROR] Two output files share the same path but have different contents: out/storeOrders.js.map
✘ [ERROR] Two output files share the same path but have different contents: out/storeOrders.js
```

## Reproduction Steps
1. Set up Chef project with e-commerce template in `template/` directory
2. Generate WebContainer snapshot using `node make-bootstrap-snapshot.js`
3. Start Chef application (`pnpm run dev` + `npx convex dev`)
4. Create new chat session
5. Attempt to deploy Convex functions
6. Error occurs during "Bundling component schemas and implementations" phase

## Investigation Summary

### What We Verified ✅
1. **Template directory is clean**: Only ONE copy of each file exists
   - Confirmed via: `git ls-files` and directory listing
   - Files: storeProducts.ts, storeCart.ts, storeOrders.ts, storeRoles.ts, storeRouter.ts

2. **Snapshot generation is correct**: 
   - Latest snapshot: `template-snapshot-a72bdec1.bin` (129KB, 35 files)
   - Verified snapshot only includes tracked files
   - No duplicate directories or paths

3. **WebContainer loads clean files**:
   - Browser console validation confirmed only 9 TypeScript files in convex/
   - No duplicate source files present in WebContainer filesystem

4. **Configuration files updated**:
   - `chef-agent/constants.ts`: PREWARM_PATHS updated with renamed files
   - `chef-agent/prompts/solutionConstraints.ts`: System prompts list correct filenames
   - `template/convex/http.ts`: Import updated to use `./storeRouter`

### Attempted Solutions ❌
All failed to resolve the issue:

1. **Removed duplicate template folder**
   - Deleted `template/ecommerce/` backup directory
   - Regenerated snapshot
   - Error persisted

2. **Renamed backend files for uniqueness**
   - products.ts → storeProducts.ts
   - cart.ts → storeCart.ts
   - orders.ts → storeOrders.ts
   - roles.ts → storeRoles.ts
   - router.ts → storeRouter.ts
   - Updated all frontend imports
   - Error persisted with NEW filenames

3. **Excluded `_generated` from snapshot**
   - Added `convex/_generated` to `.gitignore`
   - Removed stale generated files from git tracking
   - Regenerated snapshot (reduced from 40 to 35 files)
   - Error persisted

4. **Cache busting attempts**
   - Added query parameters to TEMPLATE_URL
   - Tested in incognito mode
   - Hard browser refreshes
   - Completely new chat sessions
   - Restarted dev servers multiple times
   - Error persisted

5. **Created fresh Convex deployments**
   - Cleared `.env.local` in WebContainer
   - Provisioned new Convex deployments
   - Error persisted

## Root Cause Hypothesis
The error message states files have "**different contents**", suggesting Convex's bundler is finding TWO source files that compile to the same output path but contain different code.

Possible causes:
1. **Convex bundler caching issue**: Internal state retaining old versions of files
2. **WebContainer snapshot loading bug**: Binary snapshot not fully replacing old files
3. **Convex deployment-level caching**: Old schema persisting at deployment infrastructure level
4. **Race condition**: Multiple WebContainer instances or deployment processes conflicting

## Impact
- **Severity**: Critical - Blocks all e-commerce template deployments
- **Workaround**: None identified
- **User Impact**: Cannot use pre-built e-commerce template; must build from scratch

## Technical Details

### File Structure (Final State)
```
template/
├── convex/
│   ├── schema.ts
│   ├── storeProducts.ts  ← Renamed from products.ts
│   ├── storeCart.ts      ← Renamed from cart.ts
│   ├── storeOrders.ts    ← Renamed from orders.ts
│   ├── storeRoles.ts     ← Renamed from roles.ts
│   ├── storeRouter.ts    ← Renamed from router.ts
│   ├── auth.ts
│   ├── http.ts
│   └── tsconfig.json
├── src/
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── CartPage.tsx
│   │   ├── OrdersPage.tsx
│   │   └── AdminDashboard.tsx
│   └── components/
│       ├── Navbar.tsx
│       └── ProductCard.tsx
└── [other config files]
```

### Snapshot Generation Command
```bash
node make-bootstrap-snapshot.js
```

**Output**: `template-snapshot-a72bdec1.bin` (129,148 bytes, 35 files)

### Convex Deployment Process
1. WebContainer loads snapshot → ✅ Successful
2. npm install → ✅ Successful  
3. Convex provisions deployment → ✅ Successful
4. "Finding component definitions..." → ✅ Successful
5. "Generating server code..." → ✅ Successful
6. "Bundling component definitions..." → ✅ Successful
7. "Bundling component schemas and implementations..." → ❌ **FAILS HERE**

## Additional Context

### System Configuration
- **Package Manager**: pnpm@9.5.0
- **Node.js**: >=18.18.0
- **Build Tool**: Vite with Remix
- **Backend**: Convex (reactive database)
- **Runtime**: WebContainer API (browser-based Node.js)

### Files Modified During Troubleshooting
1. `template/.gitignore` - Added `convex/_generated`
2. `template/convex/http.ts` - Updated import from `./router` to `./storeRouter`
3. `chef-agent/constants.ts` - Updated PREWARM_PATHS with renamed files
4. `chef-agent/prompts/solutionConstraints.ts` - Updated file listings
5. All frontend files - Updated API imports (e.g., `api.products` → `api.storeProducts`)

### Diagnostic Commands Used
```bash
# List files in snapshot source
cd template ; git ls-files

# Verify snapshot content
node make-bootstrap-snapshot.js 2>&1 | grep "Copying"

# Check WebContainer files (browser console)
await window.webcontainer.fs.readdir('/home/project/convex')

# Verify no duplicates
Get-ChildItem -Recurse template/convex/*.ts
```

## Recommendations

### For Immediate Resolution
1. **Contact Convex Support**: Report potential bundler bug
2. **Test with minimal template**: Try deployment without e-commerce files
3. **Manual deployment**: Deploy functions individually outside WebContainer
4. **Alternative approach**: Have AI agent create files on-demand instead of pre-loading

### For Long-term Fix
1. **Add debug logging** to Convex bundler to identify duplicate source
2. **Implement bundler cache clearing** in WebContainer before deployment
3. **Version snapshots** with hash verification to ensure correct loading
4. **Add pre-deployment validation** to detect duplicate files before bundling

## Related Issues
- Convex deployment failures in WebContainer environments
- Snapshot caching problems in browser-based runtimes
- File renaming not clearing internal bundler state

## Attachments
- Snapshot file: `template-snapshot-a72bdec1.bin` (129KB)
- Error logs: Full deployment error traces
- Verification scripts: Browser console commands used for debugging

## Reporter
- Date: 2025-10-27
- Environment: Windows 25H2, PowerShell
- IDE: Qoder IDE 0.2.8

---

**Status**: UNRESOLVED - Awaiting investigation by Convex/WebContainer teams
