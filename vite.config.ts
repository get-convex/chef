import { vitePlugin as remix } from '@remix-run/dev';
import { defineConfig } from 'vite';
import { vercelPreset } from '@vercel/remix/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import * as dotenv from 'dotenv';
import UnoCSS from 'unocss/vite';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

dotenv.config();

// Get detailed git info with fallbacks
const getGitInfo = () => {
  try {
    return {
      commitHash: execSync('git rev-parse --short HEAD').toString().trim(),
      branch: execSync('git rev-parse --abbrev-ref HEAD').toString().trim(),
      commitTime: execSync('git log -1 --format=%cd').toString().trim(),
      author: execSync('git log -1 --format=%an').toString().trim(),
      email: execSync('git log -1 --format=%ae').toString().trim(),
      remoteUrl: execSync('git config --get remote.origin.url').toString().trim(),
      repoName: execSync('git config --get remote.origin.url')
        .toString()
        .trim()
        .replace(/^.*github.com[:/]/, '')
        .replace(/\.git$/, ''),
    };
  } catch {
    return {
      commitHash: 'no-git-info',
      branch: 'unknown',
      commitTime: 'unknown',
      author: 'unknown',
      email: 'unknown',
      remoteUrl: 'unknown',
      repoName: 'unknown',
    };
  }
};

// Read package.json with detailed dependency info
const getPackageJson = () => {
  try {
    const pkgPath = join(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

    return {
      name: pkg.name,
      description: pkg.description,
      license: pkg.license,
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {},
      peerDependencies: pkg.peerDependencies || {},
      optionalDependencies: pkg.optionalDependencies || {},
    };
  } catch {
    return {
      name: 'bolt.diy',
      description: 'A DIY LLM interface',
      license: 'MIT',
      dependencies: {},
      devDependencies: {},
      peerDependencies: {},
      optionalDependencies: {},
    };
  }
};

const pkg = getPackageJson();
const gitInfo = getGitInfo();

export default defineConfig((config) => {
  return {
    define: {
      __COMMIT_HASH: JSON.stringify(gitInfo.commitHash),
      __GIT_BRANCH: JSON.stringify(gitInfo.branch),
      __GIT_COMMIT_TIME: JSON.stringify(gitInfo.commitTime),
      __GIT_AUTHOR: JSON.stringify(gitInfo.author),
      __GIT_EMAIL: JSON.stringify(gitInfo.email),
      __GIT_REMOTE_URL: JSON.stringify(gitInfo.remoteUrl),
      __GIT_REPO_NAME: JSON.stringify(gitInfo.repoName),
      __APP_VERSION: JSON.stringify(process.env.npm_package_version),
      __PKG_NAME: JSON.stringify(pkg.name),
      __PKG_DESCRIPTION: JSON.stringify(pkg.description),
      __PKG_LICENSE: JSON.stringify(pkg.license),
      __PKG_DEPENDENCIES: JSON.stringify(pkg.dependencies),
      __PKG_DEV_DEPENDENCIES: JSON.stringify(pkg.devDependencies),
      __PKG_PEER_DEPENDENCIES: JSON.stringify(pkg.peerDependencies),
      __PKG_OPTIONAL_DEPENDENCIES: JSON.stringify(pkg.optionalDependencies),
      // Define global values
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    },

    /*
     * Remix Vite likes to avoid bundling server-side code, so you can end up with errors in Vercel like
     *
     * [commonjs--resolver] Could not load /Users/tomb/simple-vercel-remix/node_modules/.pnpm/util@0.12.5/node_modules/util/types:
     * ENOENT: no such file or directory, open '/Users/tomb/simple-vercel-remix/node_modules/.pnpm/util@0.12.5/node_modules/util/types'
     *
     * so we may need to bundle in prod. But we need to make sure we don't bundle do it in dev:
     * https://github.com/remix-run/react-router/issues/13075
     *
     * If we have this issue we need to turn on `noExternal: true`, or manually bundle more libraries.
     */
    ssr:
      config.command === 'build'
        ? {
            // noExternal: true,
            //
            // Some dependencies are hard to bundler.
            external: [
              // the bundler must think this has side effects because I can't
              // bundle it without problems
              'cloudflare',
              // something about eval
              '@protobufjs/inquire',
              // doesn't actually help, remove this
              '@protobufjs/inquire?commonjs-external',

              // these were guesses to fix a bundling issue, must have
              // needed at least on of the not to be bundled.
              'semver',
              'semver-parser',
              '@sentry/remix',

              'vite-plugin-node-polyfills',
            ],
          }
        : { noExternal: ['@protobufjs/inquire'] },
    build: {
      //sourcemap: true,
      // this enabled top-level await
      target: 'esnext',
      sourcemap: true,
      rollupOptions: {
        output: {
          format: 'esm',
        },
      },
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
    optimizeDeps: {
      include: [
        'jose', // discovered late, so causes a reload when optimizing
      ],
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
      },
    },
    resolve: {
      alias: {
        buffer: 'vite-plugin-node-polyfills/polyfills/buffer',
        ...(config.mode === 'test' ? { 'lz4-wasm': 'lz4-wasm/dist/index.js' } : {}),
      },
    },
    plugins: [
      // This is complicated: we're polyfilling the browser (!) for some things
      // and were previously polyfilling Cloudflare worker functions for some things.
      // Now we could probably remove some since we're using Node.js in Vercel
      // instead of Cloudflare or Vercel Edge workers.
      nodePolyfills({
        include: ['buffer', 'process', 'stream'],
        globals: {
          Buffer: true,
          process: true, // this is actually require for some terminal stuff
          // like the shell tool
          global: true,
        },
        protocolImports: true,
        // Exclude Node.js modules that shouldn't be polyfilled in Cloudflare
        exclude: ['child_process', 'fs', 'path'],
      }),
      // just added, should remove if not needed
      {
        name: 'buffer-polyfill',
        transform(code, id) {
          if (id.includes('env.mjs')) {
            return {
              code: `import { Buffer } from 'buffer';\n${code}`,
              map: null,
            };
          }
        },
      },

      remix({
        presets: [vercelPreset()],
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_lazyRouteDiscovery: true,
        },
      }),
      UnoCSS(),
      tsconfigPaths(),
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
      wasm(),
    ],
    envPrefix: ['VITE_'],
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
  };
});
