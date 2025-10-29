# Convex Bundler "Duplicate Output Files" Error - Solution

## Problem Summary

When deploying the e-commerce template in WebContainer, Convex bundler was generating errors:
```
Two output files share the same path but have different contents
```

Affected files:
- `storeOrders.js`
- `storeCart.js`
- `storeProducts.js`
- `storeRoles.js`
- `http.js`
- `auth.js`

## Root Causes Identified

### 1. Circular TypeScript Configuration Dependency
**Location:** `template/convex/tsconfig.json`

**Issue:**
- The template's convex tsconfig was extending `../tsconfig.json` (the root project's config)
- This created a problematic module resolution path where the Convex bundler could see conflicting configurations
- The parent tsconfig had path aliases (`@convex/*`) that could confuse the bundler

**Fix:**
Made `template/convex/tsconfig.json` standalone with all necessary compiler options:
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["ES2021"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["node"],
    "skipLibCheck": true,
    "strict": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["."],
  "exclude": ["../*"]
}
```

### 2. Conflicting Auth Configuration Files
**Location:** `template/convex/`

**Issue:**
- The template had BOTH `auth.config.ts` AND `auth.ts`
- `auth.ts` contained the actual auth implementation using `convexAuth()` with Password and Anonymous providers
- `auth.config.ts` was an unused leftover file that wasn't imported anywhere
- Convex's bundler processes both files, potentially trying to generate auth-related outputs from two different sources
- This caused conflicts in the module bundling process

**Fix:**
- Removed `template/convex/auth.config.ts` completely
- Used `git rm` to remove it from git tracking so it won't be included in future snapshots
- The auth implementation in `auth.ts` is sufficient and follows best practices

## Additional Preventive Measures

### 3. Created `.convexignore`
**Location:** Project root

Added explicit exclusion rules for the main project's Convex deployment:
```
# Exclude template directory from Convex deployment
template/
template/**

# Exclude test directories
test-kitchen/
chefshot/
chef-agent/
```

While this doesn't affect the WebContainer deployment directly, it prevents any potential issues when deploying the main Chef project.

## How the WebContainer Snapshot Works

1. **Snapshot Creation:** `make-bootstrap-snapshot.js` uses `git ls-files` in the `template/` directory
2. **File Selection:** Only unignored, git-tracked files from `template/` are included
3. **WebContainer Mount:** When deployed, the template contents become the root filesystem
4. **Convex Bundling:** `convex dev` runs in the WebContainer and bundles only the mounted template's `convex/` directory

## Testing the Fix

After rebuilding the snapshot (new hash: `fbfada58`), test the deployment:

1. Start the Chef development environment:
   ```bash
   pnpm run dev
   npx convex dev
   ```

2. Create a new chat in the browser

3. The WebContainer should mount the new snapshot and deploy without bundler errors

4. Verify in browser console that Convex deployment succeeds

## Files Changed

1. ✅ `template/convex/tsconfig.json` - Made standalone, removed parent extension
2. ✅ `template/convex/auth.config.ts` - Deleted (unused, conflicting)
3. ✅ `.convexignore` - Created (preventive measure)
4. ✅ `public/template-snapshot-fbfada58.bin` - New snapshot with fixes
5. ✅ `app/lib/stores/startup/useContainerSetup.ts` - Auto-updated with new snapshot URL

## Why This Happened

The error occurred specifically in WebContainer (browser-based Node.js) because:

1. **Strict Module Resolution:** WebContainer may handle module resolution more strictly than traditional Node.js
2. **Bundler Sensitivity:** The Convex bundler in WebContainer was more sensitive to configuration conflicts
3. **Path Resolution:** TypeScript's module resolution with extended configs can create ambiguous paths that work locally but fail in constrained environments

## Prevention

To prevent similar issues in the future:

1. ✅ Keep template configs self-contained (no external extends)
2. ✅ Remove unused configuration files, especially those with special naming conventions (*.config.ts)
3. ✅ Rebuild the snapshot after any changes to template/ directory files
4. ✅ Test in WebContainer environment after significant configuration changes

## Related Documentation

- [Convex Bundling Docs](https://docs.convex.dev/functions/bundling)
- [@convex-dev/auth Documentation](https://labs.convex.dev/auth)
- [WebContainer API Docs](https://webcontainers.io/api)

