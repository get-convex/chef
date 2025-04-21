import { vitePlugin as remix } from '@remix-run/dev';
import { defineConfig } from 'vite';
import { vercelPreset } from '@vercel/remix/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import * as dotenv from 'dotenv';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { sentryVitePlugin } from '@sentry/vite-plugin';

dotenv.config();

export default defineConfig((config) => {
  return {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.env.VERCEL_ENV': JSON.stringify(process.env.VERCEL_ENV),
      'process.env.VERCEL_GIT_COMMIT_REF': JSON.stringify(process.env.VERCEL_ENV),
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
              '@sentry/remix',

              'vite-plugin-node-polyfills',
            ],
          }
        : { noExternal: ['@protobufjs/inquire'] },
    build: {
      // this enabled top-level await
      target: 'esnext',
      // our source isn't very secret, but this does make it very important not to harcode secrets:
      // sourcemaps may include backend code!
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
        'jose', // discovered late during dev so causes a reload when optimizing
        'classnames', // fix for @convex-dev/design-system to work

        // these are all used by @convex-dev/design-system/Combobox
        'react-dom',
        'react-fast-compare',
        'warning',
        'fuzzy',
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
    server: {
      // feel free to disable, just using this to foolproof dev
      strictPort: true,
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
      // Required to run the file write tool locally
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
        // Vercel presets move build outputs to ./build/server/nodejs-eyABC...
        // making it harder to serve them locally.
        // Hopefully it does nothing else important...
        ...(process.env.VERCEL ? { presets: [vercelPreset()] } : {}),
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_lazyRouteDiscovery: true,
        },
      }),
      tsconfigPaths(),
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
      wasm(),
      sentryVitePlugin({
        // TODO there's probably some correct environment variable name to use here instead
        authToken: process.env.SENTRY_VITE_PLUGIN_AUTH_TOKEN,
        org: 'convex-dev',
        project: '4509097600811008',
        // Only upload source maps for production
        disable: process.env.VERCEL_ENV !== 'production',
      }),
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
